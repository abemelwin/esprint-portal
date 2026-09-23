/**
 * POST /api/checks/reconstruct-schedule
 *
 * Bulk-applies a payment schedule to a client's reconstruct checks.
 * For each schedule row, creates PARTIAL_PAYMENT or SETTLED_PAID events on
 * the oldest reconstruct check with a remaining balance (overflow to next).
 *
 * Adapted from esprint-check-monitoring/app/api/recon-schedule/bulk-apply
 * for AWS RDS (plain pg).
 *
 * Body: { clientCode, rows: [{ scheduleDate, monthlyAmortization?, amount, paymentDetails }], appliedBy }
 * Returns: { ok, applied, events }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { query, transaction } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

interface ScheduleRow {
  scheduleDate: string;
  monthlyAmortization?: number;
  amount: number;
  paymentDetails: string;
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot apply schedules." }, { status: 403 });
  }

  let body: { clientCode?: string; rows?: ScheduleRow[]; appliedBy?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const { clientCode, rows = [] } = body;
  const appliedBy = guard.ctx.user.fullName || guard.ctx.user.email;
  if (!clientCode || !rows.length) {
    return NextResponse.json({ ok: false, error: "clientCode and rows required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Load all checks for this client, oldest first
  const allChecks = await query<{
    id: string; original_amount: number; check_date: string | null; final_status: string | null;
  }>(
    `SELECT id, original_amount, check_date, final_status
     FROM ${SCHEMA}.checks WHERE client_code = $1 ORDER BY check_date ASC NULLS LAST`,
    [clientCode]
  );
  if (!allChecks.length) {
    return NextResponse.json({ ok: false, error: "No checks found for this client" }, { status: 400 });
  }

  // Identify reconstruct checks (RECON REPLACED status OR has a RECONSTRUCT event)
  const ids = allChecks.map((c) => c.id);
  const reconEvents = await query<{ check_id: string }>(
    `SELECT DISTINCT check_id FROM ${SCHEMA}.events
     WHERE check_id = ANY($1) AND type = 'RECONSTRUCT'`,
    [ids]
  );
  const reconIds = new Set<string>([
    ...allChecks.filter((c) => c.final_status === "RECON REPLACED").map((c) => c.id),
    ...reconEvents.map((e) => e.check_id),
  ]);
  const targetChecks = allChecks.filter((c) => reconIds.has(c.id));
  if (!targetChecks.length) {
    return NextResponse.json({ ok: false, error: "No reconstruct checks found for this client" }, { status: 400 });
  }

  // Existing payments per check
  const existing = await query<{ check_id: string; amount: number | null }>(
    `SELECT check_id, amount FROM ${SCHEMA}.events
     WHERE check_id = ANY($1) AND type IN ('PARTIAL_PAYMENT','SETTLED_PAID')`,
    [targetChecks.map((c) => c.id)]
  );
  const paidMap = new Map<string, number>();
  for (const ev of existing) paidMap.set(ev.check_id, (paidMap.get(ev.check_id) ?? 0) + (ev.amount ?? 0));

  const newEvents: {
    id: string; check_id: string; type: string; event_date: string;
    reason: string; method: string | null; amount: number; notes: string;
  }[] = [];
  const scheduleRows: {
    client_code: string; schedule_date: string | null; monthly_amortization: number | null;
    amount: number | null; payment_details: string | null; sort_order: number;
    event_id: string | null; check_id: string | null;
  }[] = [];
  let appliedCount = 0;

  for (const row of rows) {
    let firstEventId: string | null = null;
    let firstCheckId: string | null = null;

    if (row.amount && row.amount > 0) {
      let remaining = row.amount;
      for (const check of targetChecks) {
        if (remaining <= 0.01) break;
        const paid = paidMap.get(check.id) ?? 0;
        const bal = Math.round((check.original_amount - paid) * 100) / 100;
        if (bal <= 0.01) continue;

        const applied = Math.min(remaining, bal);
        const eventType = applied >= bal - 0.01 ? "SETTLED_PAID" : "PARTIAL_PAYMENT";
        const eventId = randomUUID();
        if (!firstEventId) { firstEventId = eventId; firstCheckId = check.id; }

        newEvents.push({
          id: eventId, check_id: check.id, type: eventType,
          event_date: row.scheduleDate, reason: "Reconstruct schedule payment (bulk)",
          method: row.paymentDetails || null, amount: applied,
          notes: `Bulk schedule · ${row.paymentDetails || ""}`.trim(),
        });
        paidMap.set(check.id, paid + applied);
        remaining = Math.round((remaining - applied) * 100) / 100;
      }
      appliedCount++;
    }

    scheduleRows.push({
      client_code: clientCode,
      schedule_date: row.scheduleDate || null,
      monthly_amortization: row.monthlyAmortization ?? null,
      amount: row.amount ?? null,
      payment_details: row.paymentDetails || null,
      sort_order: scheduleRows.length,
      event_id: firstEventId,
      check_id: firstCheckId,
    });
  }

  try {
    await transaction(async (client) => {
      for (const e of newEvents) {
        await client.query(
          `INSERT INTO ${SCHEMA}.events
             (id, check_id, type, event_date, move_date, reason, method, reference, amount, notes, recorded_by, recorded_at)
           VALUES ($1,$2,$3,$4,NULL,$5,$6,NULL,$7,$8,$9,$10)`,
          [e.id, e.check_id, e.type, e.event_date, e.reason, e.method, e.amount, e.notes, appliedBy, now]
        );
      }
      // Replace schedule rows for this client
      await client.query(`DELETE FROM ${SCHEMA}.recon_schedule WHERE client_code = $1`, [clientCode]);
      for (const s of scheduleRows) {
        await client.query(
          `INSERT INTO ${SCHEMA}.recon_schedule
             (client_code, schedule_date, monthly_amortization, amount, payment_details, sort_order, event_id, check_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [s.client_code, s.schedule_date, s.monthly_amortization, s.amount, s.payment_details, s.sort_order, s.event_id, s.check_id]
        );
      }
    });
    invalidateCache();
    return NextResponse.json({ ok: true, applied: appliedCount, events: newEvents.length });
  } catch (err) {
    console.error("reconstruct-schedule failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to apply schedule." }, { status: 500 });
  }
}
