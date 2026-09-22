/**
 * /api/checks/delete-requests
 *   GET    — list pending delete requests (admin only).
 *   POST   — approve or reject a delete request (admin only).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canDeleteCheck } from "@/modules/checks/lib/permissions";
import { query } from "@/lib/db";
import { softDeleteCheck, invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

export async function GET(_req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canDeleteCheck(guard.perms)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const rows = await query(
    `SELECT id, check_id, event_id, target_type, reason,
            requested_by, requested_by_name, status, created_at
     FROM ${SCHEMA}.delete_requests
     WHERE status = 'pending'
     ORDER BY created_at DESC`
  ).catch(() => []);

  return NextResponse.json({ ok: true, requests: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canDeleteCheck(guard.perms)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { requestId, action } = body; // action: 'approve' | 'reject'
  if (!requestId || !["approve","reject"].includes(action)) {
    return NextResponse.json({ error: "requestId and action (approve|reject) required." }, { status: 400 });
  }

  const rows = await query<{
    id: string; check_id: string; event_id: string | null; target_type: string;
  }>(`SELECT id, check_id, event_id, target_type FROM ${SCHEMA}.delete_requests WHERE id = $1`, [requestId]);

  if (!rows[0]) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const req_ = rows[0];

  if (action === "approve") {
    if (req_.target_type === "event" && req_.event_id) {
      await query(`DELETE FROM ${SCHEMA}.events WHERE id = $1`, [req_.event_id]);
    } else {
      await softDeleteCheck(req_.check_id, guard.ctx.user.email, guard.ctx.user.fullName);
    }
    invalidateCache();
  }

  await query(
    `UPDATE ${SCHEMA}.delete_requests SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3`,
    [action === "approve" ? "approved" : "rejected", guard.ctx.user.email, requestId]
  );

  return NextResponse.json({ ok: true });
}
