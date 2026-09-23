import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canManageUsers } from "@/modules/checks/lib/permissions";
import { query } from "@/lib/db";

const SCHEMA = "check_monitoring";

export async function GET() {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }

  try {
    const rows = await query<{
      id: string;
      check_id: string;
      check_snapshot: Record<string, unknown>;
      events_snapshot: Record<string, unknown>[];
      deleted_by: string;
      deleted_by_name: string;
      deleted_at: string;
    }>(
      `SELECT id, check_id, check_snapshot, events_snapshot, deleted_by, deleted_by_name, deleted_at
       FROM ${SCHEMA}.deleted_checks
       ORDER BY deleted_at DESC`
    );

    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    console.error("GET /api/deleted-checks failed:", err);
    return NextResponse.json({ ok: false, error: String((err as Error).message ?? err) }, { status: 500 });
  }
}
