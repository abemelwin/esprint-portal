/**
 * /api/bad-account-list
 *   GET  — list all bad-account entries (newest first).
 *   POST — add a bad-account entry.
 *
 * Standalone editable monitoring list. Ported from esprint-check-monitoring.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { sanitizeDeep } from "@/modules/checks/lib/sanitize";
import { query } from "@/lib/db";

import { VALID_STATUSES } from "@/modules/checks/lib/bad-account-statuses";

const SCHEMA = "check_monitoring";

export async function GET() {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  try {
    const rows = await query(
      `SELECT * FROM ${SCHEMA}.bad_account_list ORDER BY created_at DESC`
    );
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    console.error("GET /api/bad-account-list failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to load list." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot add entries." }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  const body = sanitizeDeep(raw) as Record<string, unknown>;

  const clientName = String(body.clientName ?? "").trim();
  const status = String(body.status ?? "");
  if (!clientName || !status) {
    return NextResponse.json({ ok: false, error: "clientName and status are required." }, { status: 400 });
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: `Invalid status: ${status}` }, { status: 400 });
  }

  try {
    const rows = await query(
      `INSERT INTO ${SCHEMA}.bad_account_list
         (id, ae, branch_id, client_name, status, notes, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       RETURNING *`,
      [
        randomUUID(), body.ae ?? null, body.branchId ?? null,
        clientName, status, body.notes ?? null, guard.ctx.user.email,
      ]
    );
    return NextResponse.json({ ok: true, row: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/bad-account-list failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to add entry." }, { status: 500 });
  }
}
