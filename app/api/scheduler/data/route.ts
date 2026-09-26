/**
 * GET /api/scheduler/data
 * Fetches all branches, staff, jobs, and user approvals from AWS RDS PostgreSQL.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { query } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "scheduler")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const branches = await query(`SELECT id, name, note FROM scheduler.branches ORDER BY name ASC`);
    const staff = await query(`SELECT id, name, role, home_branch_id AS "homeBranchId", hotline FROM scheduler.staff ORDER BY name ASC`);
    const jobs = await query(`
      SELECT id, date, jt_no AS "jtNo", staff_id AS "staffId", branch_id AS "branchId",
             customer, location, type, type_other AS "typeOther", status, status_note AS "statusNote",
             created_at AS "createdAt"
      FROM scheduler.jobs
      ORDER BY date DESC, created_at DESC
    `);
    const approvals = await query(`
      SELECT id, name, email, role, branch_ids AS "branchIds", can_edit AS "canEdit",
             is_active AS "isActive", is_approved AS "isApproved"
      FROM scheduler.registration_approvals
      ORDER BY name ASC
    `);

    return NextResponse.json({ ok: true, branches, staff, jobs, approvals });
  } catch (err: any) {
    console.error("GET /api/scheduler/data error:", err);
    return NextResponse.json({ error: "Database query failed: " + err.message }, { status: 500 });
  }
}
