import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { query } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

export async function GET() {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  try {
    const rows = await query<{ code: string; name: string; branch_id: string; ae: string | null }>(
      `SELECT code, name, branch_id, ae FROM ${SCHEMA}.clients ORDER BY name`
    );
    const clients = rows.map((r) => ({
      code: r.code,
      name: r.name,
      branch: r.branch_id,
      ae: r.ae,
    }));
    return NextResponse.json({ ok: true, clients });
  } catch (err) {
    console.error("GET /api/clients failed:", err);
    return NextResponse.json({ ok: false, error: String((err as Error).message ?? err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  const branch_id = String(body.branch_id ?? body.branch ?? "").trim();
  const ae = body.ae ? String(body.ae).trim() : null;

  if (!code || !name || !branch_id) {
    return NextResponse.json({ ok: false, error: "code, name, and branch are required." }, { status: 400 });
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
    console.error("POST /api/clients failed:", err);
    return NextResponse.json({ ok: false, error: String((err as Error).message ?? err) }, { status: 500 });
  }
}
