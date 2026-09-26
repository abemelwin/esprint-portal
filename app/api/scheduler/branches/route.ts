/**
 * /api/scheduler/branches
 *   POST   — create or update a branch in AWS RDS PostgreSQL
 *   DELETE — delete a branch from AWS RDS PostgreSQL
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
    const { id, name, note } = body;
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const branchId = id || (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));

    await query(
      `INSERT INTO scheduler.branches (id, name, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, note = EXCLUDED.note`,
      [branchId, name, note || ""]
    );

    return NextResponse.json({ ok: true, id: branchId });
  } catch (err: any) {
    console.error("POST /api/scheduler/branches error:", err);
    return NextResponse.json({ error: "Save branch failed: " + err.message }, { status: 500 });
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

    await query(`DELETE FROM scheduler.branches WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/scheduler/branches error:", err);
    return NextResponse.json({ error: "Delete branch failed: " + err.message }, { status: 500 });
  }
}
