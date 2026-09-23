/**
 * /api/recon-schedule
 *
 * GET  ?clientCode=CU07174 — get all schedule rows for a client
 * POST { clientCode, rows: [...], updatedBy } — replace all rows for a client (upsert)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCheckAccess } from '@/modules/checks/lib/api-guard';
import { canCreate } from '@/modules/checks/lib/permissions';
import { query, transaction } from '@/lib/db';
import { randomUUID } from 'crypto';

const SCHEMA = 'check_monitoring';

interface ScheduleRow {
  id?: string;
  scheduleDate: string | null;
  monthlyAmortization?: number | null;
  amount: number | null;
  paymentDetails: string | null;
  sortOrder: number;
  eventId?: string | null;
  checkId?: string | null;
}

export async function GET(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const clientCode = req.nextUrl.searchParams.get('clientCode');
  if (!clientCode) return NextResponse.json({ ok: false, error: 'clientCode required' }, { status: 400 });

  try {
    const data = await query<{
      id: string;
      schedule_date: string | null;
      monthly_amortization: number | null;
      amount: number | null;
      payment_details: string | null;
      sort_order: number;
      event_id: string | null;
      check_id: string | null;
    }>(
      `SELECT id, schedule_date, monthly_amortization, amount, payment_details, sort_order, event_id, check_id
       FROM ${SCHEMA}.recon_schedule
       WHERE client_code = $1
       ORDER BY sort_order ASC`,
      [clientCode]
    );

    const rows = (data ?? []).map((r) => ({
      id:                   r.id,
      scheduleDate:         r.schedule_date,
      monthlyAmortization:  r.monthly_amortization ?? null,
      amount:               r.amount,
      paymentDetails:       r.payment_details,
      sortOrder:            r.sort_order,
      eventId:              r.event_id ?? null,
      checkId:              r.check_id ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Database error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: 'Not authorized.' }, { status: 403 });
  }

  let body: { clientCode?: string; rows?: ScheduleRow[]; updatedBy?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { clientCode, rows = [] } = body;
  if (!clientCode) return NextResponse.json({ ok: false, error: 'clientCode required' }, { status: 400 });

  try {
    await transaction(async (client) => {
      // Delete existing rows for this client then re-insert
      await client.query(`DELETE FROM ${SCHEMA}.recon_schedule WHERE client_code = $1`, [clientCode]);

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const id = r.id || randomUUID();
        await client.query(
          `INSERT INTO ${SCHEMA}.recon_schedule
             (id, client_code, schedule_date, monthly_amortization, amount, payment_details, sort_order, event_id, check_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            clientCode,
            r.scheduleDate || null,
            r.monthlyAmortization ?? null,
            r.amount ?? null,
            r.paymentDetails ?? null,
            i,
            r.eventId ?? null,
            r.checkId ?? null,
          ]
        );
      }
    });

    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Database error' }, { status: 500 });
  }
}
