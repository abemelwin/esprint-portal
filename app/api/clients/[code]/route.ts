import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { query } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

export async function PUT(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const code = decodeURIComponent(params.code);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const branch_id = String(body.branch_id ?? body.branch ?? "").trim();
  const ae = body.ae ? String(body.ae).trim() : null;

  if (!name || !branch_id) {
    return NextResponse.json({ ok: false, error: "name and branch are required." }, { status: 400 });
  }

  try {
    await query(
      `INSERT INTO ${SCHEMA}.clients (code, name, branch_id, ae)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         branch_id = EXCLUDED.branch_id,
         ae = EXCLUDED.ae`,
      [code, name, branch_id, ae]
    );

    invalidateCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`PUT /api/clients/${code} failed:`, err);
    return NextResponse.json({ ok: false, error: String((err as Error).message ?? err) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const code = decodeURIComponent(params.code);

  try {
    await query(`DELETE FROM ${SCHEMA}.clients WHERE code = $1`, [code]);
    invalidateCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/clients/${code} failed:`, err);
    return NextResponse.json({ ok: false, error: String((err as Error).message ?? err) }, { status: 500 });
  }
}
