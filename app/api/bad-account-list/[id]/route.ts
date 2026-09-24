/**
 * /api/bad-account-list/[id]
 *   PATCH  — update an entry.
 *   DELETE — delete an entry.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { sanitizeDeep } from "@/modules/checks/lib/sanitize";
import { query } from "@/lib/db";
import { VALID_STATUSES } from "@/modules/checks/lib/bad-account-statuses";

const SCHEMA = "check_monitoring";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  const body = sanitizeDeep(raw) as Record<string, unknown>;

  if (body.status !== undefined && !VALID_STATUSES.has(String(body.status))) {
    return NextResponse.json({ ok: false, error: `Invalid status: ${body.status}` }, { status: 400 });
  }

  // Build a dynamic SET clause from provided fields
  const sets: string[] = ["updated_at = now()"];
  const vals: unknown[] = [];
  let i = 1;
  const map: Record<string, string> = {
    ae: "ae", branchId: "branch_id", clientName: "client_name",
    status: "status", notes: "notes",
  };
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(body[key]); }
  }
  vals.push(params.id);

  try {
    const rows = await query(
      `UPDATE ${SCHEMA}.bad_account_list SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!rows[0]) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (err) {
    console.error("PATCH /api/bad-account-list/[id] failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to update entry." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  try {
    await query(`DELETE FROM ${SCHEMA}.bad_account_list WHERE id = $1`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/bad-account-list/[id] failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to delete entry." }, { status: 500 });
  }
}
