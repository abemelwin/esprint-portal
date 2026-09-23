import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canManageUsers } from "@/modules/checks/lib/permissions";
import { query } from "@/lib/db";

const SCHEMA = "check_monitoring";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }

  const id = params.id;

  try {
    await query(`DELETE FROM ${SCHEMA}.deleted_checks WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/deleted-checks/${id} failed:`, err);
    return NextResponse.json({ ok: false, error: String((err as Error).message ?? err) }, { status: 500 });
  }
}
