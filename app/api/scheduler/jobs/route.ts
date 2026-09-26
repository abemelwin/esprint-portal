/**
 * /api/scheduler/jobs
 *   POST   — create or update a job in AWS RDS PostgreSQL
 *   DELETE — delete a job from AWS RDS PostgreSQL
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
    const { id, date, jtNo, staffId, branchId, customer, location, type, typeOther, status, statusNote } = body;

    if (!date || !jtNo) {
      return NextResponse.json({ error: "Date and JT No are required" }, { status: 400 });
    }

    const jobId = id || (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));

    await query(
      `INSERT INTO scheduler.jobs (id, date, jt_no, staff_id, branch_id, customer, location, type, type_other, status, status_note, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date,
         jt_no = EXCLUDED.jt_no,
         staff_id = EXCLUDED.staff_id,
         branch_id = EXCLUDED.branch_id,
         customer = EXCLUDED.customer,
         location = EXCLUDED.location,
         type = EXCLUDED.type,
         type_other = EXCLUDED.type_other,
         status = EXCLUDED.status,
         status_note = EXCLUDED.status_note,
         updated_at = NOW()`,
      [
        jobId,
        date,
        jtNo,
        staffId || null,
        branchId || null,
        customer || "",
        location || "",
        type || "installation",
        typeOther || null,
        status || "pending",
        statusNote || null,
      ]
    );

    return NextResponse.json({ ok: true, id: jobId });
  } catch (err: any) {
    console.error("POST /api/scheduler/jobs error:", err);
    return NextResponse.json({ error: "Save job failed: " + err.message }, { status: 500 });
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

    await query(`DELETE FROM scheduler.jobs WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/scheduler/jobs error:", err);
    return NextResponse.json({ error: "Delete job failed: " + err.message }, { status: 500 });
  }
}
