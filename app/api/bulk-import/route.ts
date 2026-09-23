/**
 * POST /api/bulk-import
 * Mass-import checks from a parsed file.
 *   updateMode: false — insert new checks only, skip existing.
 *   updateMode: true  — update fields + replace HOLD_REQUEST events on existing.
 *
 * Adapted from esprint-check-monitoring for AWS RDS (plain pg).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { query, transaction } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

interface ParsedRow {
  _row: number;
  branch: string;
  clientName: string;
  ae: string | null;
  bank: string;
  checkNo: string;
  checkDate: string | null;
  amount: number | null;
  totalPaid: number | null;
  holdReturnDate: string | null;
  returnReason: string | null;
  requestDate: string | null;
  actualDepositDate: string | null;
  notes: string;
  subsidiary: string | null;
  paymentFor: string | null;
  paymentDescription: string | null;
  statusHint: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ev = Record<string, any>;

function resolveStatusHint(statusHint: string | null): {
  finalStatus: string | null;
  eventType: "RETURN" | "HOLD_REQUEST" | "RECONSTRUCT" | "ALTERATION" | "DEPOSIT_CLEARED" | null;
} {
  if (!statusHint) return { finalStatus: null, eventType: null };
  const s = statusHint.toUpperCase().replace(/\s+/g, " ").trim();
  if (s === "RETURNED" || s === "RETURN")   return { finalStatus: null, eventType: "RETURN" };
  if (s === "HOLD" || s === "HELD")         return { finalStatus: null, eventType: "HOLD_REQUEST" };
  if (s === "RECON" || s === "RECONSTRUCT") return { finalStatus: "RECONSTRUCT", eventType: "RECONSTRUCT" };
  if (s === "ALTERATION" || s === "ALT")    return { finalStatus: "ALTERATION", eventType: "ALTERATION" };
  if (s === "CLEARED" || s === "DEPOSITED") return { finalStatus: null, eventType: "DEPOSIT_CLEARED" };
  if (s === "CANCELLED" || s === "CANCEL")  return { finalStatus: "CANCELLED", eventType: null };
  if (s === "LEGAL")                        return { finalStatus: "LEGAL", eventType: null };
  if (s.startsWith("BSP MEMO"))             return { finalStatus: s, eventType: null };
  return { finalStatus: null, eventType: null };
}

function buildEvents(checkId: string, r: ParsedRow, importedBy: string, now: string): Ev[] {
  const events: Ev[] = [];
  const evDate = r.holdReturnDate ?? r.checkDate ?? now.slice(0, 10);
  const { eventType } = resolveStatusHint(r.statusHint);
  const primaryType = eventType ?? (r.returnReason ? "RETURN" : (r.holdReturnDate || r.requestDate) ? "HOLD_REQUEST" : null);

  if (primaryType === "RETURN") {
    events.push({ id: randomUUID(), check_id: checkId, type: "RETURN", event_date: evDate, move_date: null, reason: r.returnReason || null, method: null, reference: null, amount: r.amount ?? null, notes: "", recorded_by: importedBy, recorded_at: now });
    if (r.requestDate?.trim() && r.requestDate > evDate) {
      events.push({ id: randomUUID(), check_id: checkId, type: "HOLD_REQUEST", event_date: evDate, move_date: r.requestDate, reason: "Redeposit after return", method: null, reference: null, amount: null, notes: "", recorded_by: importedBy, recorded_at: now });
    }
  } else if (primaryType === "HOLD_REQUEST") {
    if (r.requestDate?.trim()) {
      events.push({ id: randomUUID(), check_id: checkId, type: "HOLD_REQUEST", event_date: evDate, move_date: r.requestDate, reason: "Per schedule", method: null, reference: null, amount: null, notes: "", recorded_by: importedBy, recorded_at: now });
    }
  } else if (primaryType === "RECONSTRUCT") {
    events.push({ id: randomUUID(), check_id: checkId, type: "RECONSTRUCT", event_date: evDate, move_date: null, reason: r.returnReason ?? null, method: null, reference: null, amount: null, notes: r.notes || "", recorded_by: importedBy, recorded_at: now });
  } else if (primaryType === "ALTERATION") {
    events.push({ id: randomUUID(), check_id: checkId, type: "ALTERATION", event_date: evDate, move_date: null, reason: r.returnReason ?? null, method: null, reference: null, amount: null, notes: r.notes || "", recorded_by: importedBy, recorded_at: now });
  }

  if (r.actualDepositDate || primaryType === "DEPOSIT_CLEARED") {
    events.push({ id: randomUUID(), check_id: checkId, type: "DEPOSIT_CLEARED", event_date: r.actualDepositDate ?? evDate, move_date: null, reason: null, method: null, reference: null, amount: r.amount ?? null, notes: "", recorded_by: importedBy, recorded_at: now });
  }
  if (r.totalPaid && r.totalPaid > 0) {
    events.push({ id: randomUUID(), check_id: checkId, type: "PARTIAL_PAYMENT", event_date: evDate, move_date: null, reason: null, method: "IMPORTED", reference: null, amount: r.totalPaid, notes: "Imported partial payment", recorded_by: importedBy, recorded_at: now });
  }
  return events;
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot import checks." }, { status: 403 });
  }

  let body: { rows?: ParsedRow[]; updateMode?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const { rows = [], updateMode = false } = body;
  const importedBy = guard.ctx.user.email;
  if (!rows.length) return NextResponse.json({ ok: false, error: "No rows provided" }, { status: 400 });

  const now = new Date().toISOString();

  // Existing checks map
  const existingChecks = await query<{ id: string; branch_id: string; bank: string | null; check_no: string }>(
    `SELECT id, branch_id, bank, check_no FROM ${SCHEMA}.checks`
  );
  const existingCheckMap = new Map<string, string>(
    existingChecks.map((c) => [`${c.branch_id}|${(c.bank ?? "").toUpperCase()}|${String(c.check_no).trim().toLowerCase()}`, c.id])
  );

  // Existing clients map
  const existingClients = await query<{ code: string; name: string; branch_id: string }>(
    `SELECT code, name, branch_id FROM ${SCHEMA}.clients`
  );
  const clientMap = new Map<string, string>(
    existingClients.map((c) => [`${c.branch_id}|${String(c.name).toUpperCase()}`, c.code])
  );
  const codeNums = existingClients.map((c) => { const m = String(c.code ?? "").match(/(\d+)$/); return m ? parseInt(m[1]) : 0; });
  let nextClientNum = codeNums.length ? Math.max(...codeNums) + 1 : 1;

  const newClientRows: { code: string; name: string; branch_id: string; ae: string | null }[] = [];
  const newCheckRows: Ev[] = [];
  const newEventRows: Ev[] = [];
  const checkPatches: { id: string; patch: Record<string, unknown> }[] = [];
  const holdDeleteIds: string[] = [];
  const updateModeEvents: Ev[] = [];

  let skipped = 0, updated = 0;
  const seen = new Set<string>();

  for (const r of rows) {
    const dupKey = `${r.branch}|${(r.bank ?? "").toUpperCase()}|${String(r.checkNo).trim().toLowerCase()}`;
    const existingId = existingCheckMap.get(dupKey);

    if (existingId) {
      if (!updateMode) { skipped++; continue; }
      updated++;
      const { finalStatus } = resolveStatusHint(r.statusHint);
      const patch: Record<string, unknown> = {};
      if (r.subsidiary)         patch.subsidiary          = r.subsidiary;
      if (r.ae)                 patch.ae                  = r.ae;
      if (r.paymentFor)         patch.payment_for         = r.paymentFor;
      if (r.paymentDescription) patch.payment_description = r.paymentDescription;
      if (r.notes)              patch.notes               = r.notes;
      if (finalStatus)          patch.final_status        = finalStatus;
      if (Object.keys(patch).length) checkPatches.push({ id: existingId, patch });
      holdDeleteIds.push(existingId);
      updateModeEvents.push(...buildEvents(existingId, r, importedBy, now).filter((e) => e.type === "HOLD_REQUEST"));
      continue;
    }

    if (seen.has(dupKey)) { skipped++; continue; }
    seen.add(dupKey);

    const clientKey = `${r.branch}|${r.clientName.toUpperCase()}`;
    let clientCode = clientMap.get(clientKey);
    if (!clientCode) {
      clientCode = "C-" + String(nextClientNum++).padStart(4, "0");
      clientMap.set(clientKey, clientCode);
      newClientRows.push({ code: clientCode, name: r.clientName, branch_id: r.branch, ae: r.ae ?? null });
    }

    const checkId = randomUUID();
    const { finalStatus } = resolveStatusHint(r.statusHint);
    newCheckRows.push({
      id: checkId, client_code: clientCode, branch_id: r.branch, subsidiary: r.subsidiary || null,
      ae: r.ae || null, bank: r.bank || null, check_no: r.checkNo, check_date: r.checkDate || null,
      original_amount: r.amount ?? 0, payment_for: r.paymentFor || null,
      payment_description: r.paymentDescription || null, notes: r.notes || null,
      final_status: finalStatus || null, created_by: importedBy, created_at: now,
    });
    newEventRows.push(...buildEvents(checkId, r, importedBy, now));
  }

  try {
    await transaction(async (client) => {
      for (const c of newClientRows) {
        await client.query(
          `INSERT INTO ${SCHEMA}.clients (code, name, branch_id, ae) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
          [c.code, c.name, c.branch_id, c.ae]
        );
      }
      for (const c of newCheckRows) {
        await client.query(
          `INSERT INTO ${SCHEMA}.checks
             (id, client_code, branch_id, subsidiary, ae, bank, check_no, check_date, original_amount, payment_for, payment_description, notes, final_status, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [c.id, c.client_code, c.branch_id, c.subsidiary, c.ae, c.bank, c.check_no, c.check_date, c.original_amount, c.payment_for, c.payment_description, c.notes, c.final_status, c.created_by, c.created_at]
        );
      }
      for (const e of newEventRows) {
        await client.query(
          `INSERT INTO ${SCHEMA}.events (id, check_id, type, event_date, move_date, reason, method, reference, amount, notes, recorded_by, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [e.id, e.check_id, e.type, e.event_date, e.move_date, e.reason, e.method, e.reference, e.amount, e.notes, e.recorded_by, e.recorded_at]
        );
      }

      // Update mode
      if (updateMode) {
        for (const { id, patch } of checkPatches) {
          const cols = Object.keys(patch);
          const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
          await client.query(`UPDATE ${SCHEMA}.checks SET ${sets} WHERE id = $1`, [id, ...cols.map((c) => patch[c])]);
        }
        if (holdDeleteIds.length) {
          await client.query(`DELETE FROM ${SCHEMA}.events WHERE check_id = ANY($1) AND type = 'HOLD_REQUEST'`, [holdDeleteIds]);
        }
        for (const e of updateModeEvents) {
          await client.query(
            `INSERT INTO ${SCHEMA}.events (id, check_id, type, event_date, move_date, reason, method, reference, amount, notes, recorded_by, recorded_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [e.id, e.check_id, e.type, e.event_date, e.move_date, e.reason, e.method, e.reference, e.amount, e.notes, e.recorded_by, e.recorded_at]
          );
        }
      }
    });
    invalidateCache();
    return NextResponse.json({
      ok: true, checks: newCheckRows.length,
      events: newEventRows.length + updateModeEvents.length,
      newClients: newClientRows.length, skipped, updated,
    });
  } catch (err) {
    console.error("bulk-import failed:", err);
    return NextResponse.json({ ok: false, error: `Import failed: ${(err as Error).message}` }, { status: 500 });
  }
}
