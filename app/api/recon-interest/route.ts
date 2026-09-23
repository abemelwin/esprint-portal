/**
 * /api/recon-interest
 *   GET  ?clientCode=XXX — get interest amount for a client.
 *   POST { clientCode, interestAmount } — upsert interest.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { query } from "@/lib/db";

const SCHEMA = "check_monitoring";

export async function GET(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const clientCode = req.nextUrl.searchParams.get("clientCode");
  if (!clientCode) return NextResponse.json({ ok: false, error: "clientCode required" }, { status: 400 });

  try {
    const rows = await query<{ interest_amount: number }>(
      `SELECT interest_amount FROM ${SCHEMA}.recon_interest WHERE client_code = $1`,
      [clientCode]
    );
    return NextResponse.json({ ok: true, interestAmount: rows[0]?.interest_amount ?? 0 });
  } catch (err) {
    console.error("GET /api/recon-interest failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to load interest." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const clientCode = String(body.clientCode ?? "");
  if (!clientCode) return NextResponse.json({ ok: false, error: "clientCode required" }, { status: 400 });

  try {
    await query(
      `INSERT INTO ${SCHEMA}.recon_interest (client_code, interest_amount, updated_by, updated_at)
       VALUES ($1,$2,$3, now())
       ON CONFLICT (client_code) DO UPDATE SET
         interest_amount = EXCLUDED.interest_amount, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [clientCode, Number(body.interestAmount ?? 0), guard.ctx.user.email]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/recon-interest failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to save interest." }, { status: 500 });
  }
}
