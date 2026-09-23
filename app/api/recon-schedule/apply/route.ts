/**
 * POST /api/recon-schedule/apply
 *
 * Applies a payment from a schedule row to the oldest RECON REPLACED check
 * that still has a balance. Creates a PARTIAL_PAYMENT or SETTLED_PAID event.
 *
 * Also updates the recon_schedule row with the linked event_id and check_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCheckAccess } from '@/modules/checks/lib/api-guard';
import { canCreate } from '@/modules/checks/lib/permissions';
import { query, transaction } from '@/lib/db';
import { invalidateCache } from '@/modules/checks/lib/data';
import { randomUUID } from 'crypto';

const SCHEMA = 'check_monitoring';

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: 'Not authorized.' }, { status: 403 });
  }

  let body: {
    scheduleRowId?: string;
    clientCode?: string;
    scheduleDate?: string;
    amount?: number;
    paymentDetails?: string;
    appliedBy?: string;
    existingEventId?: string;
    existingCheckId?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    scheduleRowId,
    clientCode,
    scheduleDate,
    amount = 0,
    paymentDetails = '',
    existingEventId,
    existingCheckId,
  } = body;
  const appliedBy = guard.ctx.user.fullName || guard.ctx.user.email || 'unknown';

  if (!scheduleRowId || !clientCode || !scheduleDate || !amount) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // ── EDIT MODE: update existing event ─────────────────────────────────────
  if (existingEventId && existingCheckId) {
    try {
      await transaction(async (client) => {
        await client.query(
          `UPDATE ${SCHEMA}.events
           SET event_date = $1, amount = $2, method = $3, notes = $4
           WHERE id = $5`,
          [
            scheduleDate,
            amount,
            paymentDetails || null,
            `Reconstruct schedule payment${paymentDetails ? ` · ${paymentDetails}` : ''}`,
            existingEventId,
          ]
        );

        await client.query(
          `UPDATE ${SCHEMA}.recon_schedule
           SET schedule_date = $1, amount = $2, payment_details = $3
           WHERE id = $4`,
          [
            scheduleDate,
            amount,
            paymentDetails || null,
            scheduleRowId,
          ]
        );
      });

      invalidateCache();
      return NextResponse.json({ ok: true, eventId: existingEventId, checkId: existingCheckId, updated: true });
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: `Event update failed: ${err?.message}` }, { status: 500 });
    }
  }

  // ── APPLY MODE: find oldest check with balance ───────────────────────────
  try {
    const allClientChecks = await query<{
      id: string; original_amount: number; check_date: string | null; bank: string | null; check_no: string; final_status: string | null;
    }>(
      `SELECT id, original_amount, check_date, bank, check_no, final_status
       FROM ${SCHEMA}.checks
       WHERE client_code = $1
       ORDER BY check_date ASC NULLS LAST`,
      [clientCode]
    );

    if (!allClientChecks?.length) {
      return NextResponse.json({ ok: false, error: 'No checks found for this client' }, { status: 400 });
    }

    const checkIds = allClientChecks.map(c => c.id);
    const reconEvents = await query<{ check_id: string }>(
      `SELECT DISTINCT check_id FROM ${SCHEMA}.events
       WHERE check_id = ANY($1) AND type = 'RECONSTRUCT'`,
      [checkIds]
    );

    const reconIds = new Set<string>([
      ...allClientChecks.filter(c => c.final_status === 'RECON REPLACED').map(c => c.id),
      ...reconEvents.map(e => e.check_id),
    ]);

    const replacedChecks = allClientChecks.filter(c => reconIds.has(c.id));
    if (!replacedChecks.length) {
      return NextResponse.json({ ok: false, error: 'No reconstruct checks found' }, { status: 400 });
    }

    const replacedCheckIds = replacedChecks.map(c => c.id);
    const existingEvents = await query<{ check_id: string; type: string; amount: number | null }>(
      `SELECT check_id, type, amount FROM ${SCHEMA}.events
       WHERE check_id = ANY($1) AND type IN ('PARTIAL_PAYMENT', 'SETTLED_PAID')`,
      [replacedCheckIds]
    );

    const paidMap = new Map<string, number>();
    for (const ev of existingEvents) {
      paidMap.set(ev.check_id, (paidMap.get(ev.check_id) ?? 0) + (ev.amount ?? 0));
    }

    let targetCheck: any = null;
    let remaining = 0;
    for (const check of replacedChecks) {
      const paid = paidMap.get(check.id) ?? 0;
      const bal  = Math.round((check.original_amount - paid) * 100) / 100;
      if (bal > 0.01) {
        targetCheck = check;
        remaining   = bal;
        break;
      }
    }

    if (!targetCheck) {
      return NextResponse.json({ ok: false, error: 'All checks are fully paid' }, { status: 400 });
    }

    const isFullyPaid = amount >= remaining - 0.01;
    const eventType   = isFullyPaid ? 'SETTLED_PAID' : 'PARTIAL_PAYMENT';
    const eventId     = randomUUID();

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO ${SCHEMA}.events
           (id, check_id, type, event_date, move_date, reason, method, reference, amount, notes, recorded_by, recorded_at)
         VALUES ($1, $2, $3, $4, NULL, $5, $6, NULL, $7, $8, $9, $10)`,
        [
          eventId,
          targetCheck.id,
          eventType,
          scheduleDate,
          'Reconstruct schedule payment',
          paymentDetails || null,
          amount,
          `From reconstruct schedule · ${paymentDetails || ''}`.trim(),
          appliedBy,
          now,
        ]
      );

      await client.query(
        `UPDATE ${SCHEMA}.recon_schedule
         SET event_id = $1, check_id = $2
         WHERE id = $3`,
        [eventId, targetCheck.id, scheduleRowId]
      );
    });

    invalidateCache();

    return NextResponse.json({
      ok:        true,
      eventId,
      checkId:   targetCheck.id,
      eventType,
      checkNo:   `${targetCheck.bank || ''}-${targetCheck.check_no}`,
      remaining: Math.max(0, remaining - amount),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Database error' }, { status: 500 });
  }
}
