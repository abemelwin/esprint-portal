/**
 * /api/scheduler/staff
 *   POST   — create or update a staff member in AWS RDS PostgreSQL
 *   DELETE — delete a staff member from AWS RDS PostgreSQL
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "scheduler")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, name, role, homeBranchId, hotline } = body;
    if (!name || !role) return NextResponse.json({ error: "Name and role are required" }, { status: 400 });

    const staffId = id || (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));

    await query(
      `INSERT INTO scheduler.staff (id, name, role, home_branch_id, hotline, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         home_branch_id = EXCLUDED.home_branch_id,
         hotline = EXCLUDED.hotline,
         updated_at = NOW()`,
      [staffId, name, role, homeBranchId || null, !!hotline]
    );

    return NextResponse.json({ ok: true, id: staffId });
  } catch (err: any) {
    console.error("POST /api/scheduler/staff error:", err);
    return NextResponse.json({ error: "Save staff failed: " + err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "scheduler")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await query(`DELETE FROM scheduler.staff WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/scheduler/staff error:", err);
    return NextResponse.json({ error: "Delete staff failed: " + err.message }, { status: 500 });
  }
}
