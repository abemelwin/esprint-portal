/**
 * POST /api/recon-schedule/bulk-apply
 *
 * Bulk applies a payment schedule from an uploaded file or array.
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
    clientCode?: string;
    rows?: { scheduleDate: string; monthlyAmortization?: number; amount: number; paymentDetails: string }[];
    appliedBy?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { clientCode, rows = [] } = body;
  const appliedBy = guard.ctx.user.fullName || guard.ctx.user.email || 'unknown';

  if (!clientCode || !rows.length) {
    return NextResponse.json({ ok: false, error: 'clientCode and rows required' }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    const allChecks = await query<{
      id: string; original_amount: number; check_date: string | null; bank: string | null; check_no: string; final_status: string | null;
    }>(
      `SELECT id, original_amount, check_date, bank, check_no, final_status
       FROM ${SCHEMA}.checks
       WHERE client_code = $1
       ORDER BY check_date ASC NULLS LAST`,
      [clientCode]
    );

    if (!allChecks?.length) {
      return NextResponse.json({ ok: false, error: 'No checks found for this client' }, { status: 400 });
    }

    const checkIds = allChecks.map(c => c.id);
    const reconEvents = await query<{ check_id: string }>(
      `SELECT DISTINCT check_id FROM ${SCHEMA}.events
       WHERE check_id = ANY($1) AND type = 'RECONSTRUCT'`,
      [checkIds]
    );

    const reconIds = new Set<string>([
      ...allChecks.filter(c => c.final_status === 'RECON REPLACED').map(c => c.id),
      ...reconEvents.map(e => e.check_id),
    ]);

    const targetChecks = allChecks.filter(c => reconIds.has(c.id));
    if (!targetChecks.length) {
      return NextResponse.json({ ok: false, error: 'No reconstruct checks found' }, { status: 400 });
    }

    const targetCheckIds = targetChecks.map(c => c.id);
    const existingEvents = await query<{ check_id: string; type: string; amount: number | null }>(
      `SELECT check_id, type, amount FROM ${SCHEMA}.events
       WHERE check_id = ANY($1) AND type IN ('PARTIAL_PAYMENT', 'SETTLED_PAID')`,
      [targetCheckIds]
    );

    const paidMap = new Map<string, number>();
    for (const ev of existingEvents) {
      paidMap.set(ev.check_id, (paidMap.get(ev.check_id) ?? 0) + (ev.amount ?? 0));
    }

    const newEvents: any[] = [];
    const scheduleRows: any[] = [];
    let appliedCount = 0;

    for (const row of rows) {
      let firstEventId: string | null = null;
      let firstCheckId: string | null = null;

      if (row.amount && row.amount > 0) {
        let remaining = row.amount;

        for (const check of targetChecks) {
          if (remaining <= 0.01) break;
          const paid = paidMap.get(check.id) ?? 0;
          const bal  = Math.round((check.original_amount - paid) * 100) / 100;
          if (bal <= 0.01) continue;

          const applied   = Math.min(remaining, bal);
          const eventType = applied >= bal - 0.01 ? 'SETTLED_PAID' : 'PARTIAL_PAYMENT';
          const eventId   = randomUUID();

          if (!firstEventId) { firstEventId = eventId; firstCheckId = check.id; }

          newEvents.push({
            id:          eventId,
            check_id:    check.id,
            type:        eventType,
            event_date:  row.scheduleDate,
            reason:      'Reconstruct schedule payment (bulk)',
            method:      row.paymentDetails || null,
            amount:      applied,
            notes:       `Bulk schedule · ${row.paymentDetails || ''}`.trim(),
            recorded_by: appliedBy,
            recorded_at: now,
          });

          paidMap.set(check.id, (paidMap.get(check.id) ?? 0) + applied);
          remaining = Math.round((remaining - applied) * 100) / 100;
        }
        appliedCount++;
      }

      scheduleRows.push({
        id:                   randomUUID(),
        client_code:          clientCode,
        schedule_date:        row.scheduleDate || null,
        monthly_amortization: row.monthlyAmortization ?? null,
        amount:               row.amount ?? null,
        payment_details:      row.paymentDetails || null,
        sort_order:           scheduleRows.length,
        event_id:             firstEventId,
        check_id:             firstCheckId,
      });
    }

    await transaction(async (client) => {
      for (const e of newEvents) {
        await client.query(
          `INSERT INTO ${SCHEMA}.events
             (id, check_id, type, event_date, move_date, reason, method, reference, amount, notes, recorded_by, recorded_at)
           VALUES ($1, $2, $3, $4, NULL, $5, $6, NULL, $7, $8, $9, $10)`,
          [e.id, e.check_id, e.type, e.event_date, e.reason, e.method, e.amount, e.notes, e.recorded_by, e.recorded_at]
        );
      }

      await client.query(`DELETE FROM ${SCHEMA}.recon_schedule WHERE client_code = $1`, [clientCode]);

      for (const s of scheduleRows) {
        await client.query(
          `INSERT INTO ${SCHEMA}.recon_schedule
             (id, client_code, schedule_date, monthly_amortization, amount, payment_details, sort_order, event_id, check_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [s.id, s.client_code, s.schedule_date, s.monthly_amortization, s.amount, s.payment_details, s.sort_order, s.event_id, s.check_id]
        );
      }
    });

    invalidateCache();
    return NextResponse.json({ ok: true, applied: appliedCount, events: newEvents.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Database error' }, { status: 500 });
  }
}
