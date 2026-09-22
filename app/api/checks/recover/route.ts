/**
 * POST /api/checks/recover
 * Restores a soft-deleted check (and its events) from deleted_checks archive.
 * Admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canDeleteCheck } from "@/modules/checks/lib/permissions";
import { query, transaction } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canDeleteCheck(guard.perms)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { deletedRowId } = body;
  if (!deletedRowId) return NextResponse.json({ error: "deletedRowId required." }, { status: 400 });

  const rows = await query<{
    check_id: string;
    check_snapshot: Record<string, unknown>;
    events_snapshot: Record<string, unknown>[];
  }>(
    `SELECT check_id, check_snapshot, events_snapshot FROM ${SCHEMA}.deleted_checks WHERE id = $1`,
    [deletedRowId]
  );
  if (!rows[0]) return NextResponse.json({ error: "Deleted record not found." }, { status: 404 });

  const { check_id, check_snapshot, events_snapshot } = rows[0];
  const snap = check_snapshot as Record<string, unknown>;

  await transaction(async (client) => {
    // Re-insert the check (using original snapshot columns)
    await client.query(
      `INSERT INTO ${SCHEMA}.checks
         (id, client_code, branch_id, subsidiary, ae, bank, check_no,
          check_date, original_amount, payment_for, payment_description,
          notes, final_status, blacklist_reason, replacement_of, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [
        check_id,
        snap.client_code ?? snap.client ?? null,
        snap.branch_id   ?? snap.branch  ?? null,
        snap.subsidiary  ?? null,
        snap.ae          ?? null,
        snap.bank        ?? null,
        snap.check_no    ?? snap.checkNo  ?? '',
        snap.check_date  ?? snap.checkDate ?? null,
        snap.original_amount ?? snap.originalAmount ?? 0,
        snap.payment_for     ?? snap.paymentFor     ?? null,
        snap.payment_description ?? snap.paymentDescription ?? null,
        snap.notes        ?? null,
        snap.final_status ?? snap.finalStatus ?? null,
        snap.blacklist_reason ?? snap.blacklistReason ?? null,
        snap.replacement_of   ?? snap.replacementOf   ?? null,
        snap.created_by   ?? snap.createdBy   ?? null,
        snap.created_at   ?? snap.createdAt   ?? new Date().toISOString(),
      ]
    );

    // Re-insert events
    for (const ev of (events_snapshot ?? [])) {
      const e = ev as Record<string, unknown>;
      await client.query(
        `INSERT INTO ${SCHEMA}.events
           (id, check_id, type, event_date, move_date, reason, method,
            reference, amount, notes, recorded_by, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO NOTHING`,
        [
          e.id, check_id,
          e.type, e.event_date ?? e.eventDate ?? null, e.move_date ?? e.moveDate ?? null,
          e.reason ?? null, e.method ?? null, e.reference ?? null,
          e.amount ?? null, e.notes ?? '', e.recorded_by ?? e.recordedBy ?? null,
          e.recorded_at ?? e.recordedAt ?? new Date().toISOString(),
        ]
      );
    }

    // Remove from deleted_checks archive
    await client.query(`DELETE FROM ${SCHEMA}.deleted_checks WHERE id = $1`, [deletedRowId]);
  });

  invalidateCache();
  return NextResponse.json({ ok: true });
}
