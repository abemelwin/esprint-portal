/**
 * /api/penalty
 *   GET    — list all penalty records.
 *   POST   — upsert a penalty record (add or edit).
 *   DELETE — delete a penalty record by id.
 *
 * Standalone editable list (₱500/move charges), independent of the checks
 * ledger. Ported from esprint-check-monitoring for AWS RDS.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canEdit } from "@/modules/checks/lib/permissions";
import { query } from "@/lib/db";

const SCHEMA = "check_monitoring";

export async function GET() {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  try {
    const data = await query(`SELECT * FROM ${SCHEMA}.penalty_records ORDER BY client`);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("GET /api/penalty failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to load penalty records." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canEdit(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot edit penalty records." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.client) {
    return NextResponse.json({ ok: false, error: "id and client are required." }, { status: 400 });
  }

  try {
    await query(
      `INSERT INTO ${SCHEMA}.penalty_records
         (id, client, move_num, check_no, check_date, amount, paid_charge, pending_charge, payment_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         client = EXCLUDED.client, move_num = EXCLUDED.move_num,
         check_no = EXCLUDED.check_no, check_date = EXCLUDED.check_date,
         amount = EXCLUDED.amount, paid_charge = EXCLUDED.paid_charge,
         pending_charge = EXCLUDED.pending_charge, payment_details = EXCLUDED.payment_details`,
      [
        body.id, body.client, body.move_num ?? null, body.check_no ?? null,
        body.check_date || null, Number(body.amount ?? 0),
        Number(body.paid_charge ?? 0), Number(body.pending_charge ?? 0),
        body.payment_details ?? null,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/penalty failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to save penalty record." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canEdit(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot delete penalty records." }, { status: 403 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: "id required." }, { status: 400 });

  try {
    await query(`DELETE FROM ${SCHEMA}.penalty_records WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/penalty failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to delete penalty record." }, { status: 500 });
  }
}
