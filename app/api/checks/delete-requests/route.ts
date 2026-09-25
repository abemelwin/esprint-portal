/**
 * /api/checks/delete-requests
 *   GET    — list pending delete requests (admin only).
 *   POST   — approve or reject a delete request (admin only).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canManageUsers } from "@/modules/checks/lib/permissions";
import { query } from "@/lib/db";
import { softDeleteCheck, invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

export async function GET(_req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.perms)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const rows = await query<any>(
    `SELECT dr.id, dr.check_id, dr.event_id, dr.target_type, dr.reason,
            dr.requested_by, dr.requested_by_name, dr.status, dr.created_at,
            c.check_no, c.bank, c.client_code, c.check_date,
            cl.name as client_name
     FROM ${SCHEMA}.delete_requests dr
     LEFT JOIN ${SCHEMA}.checks c ON c.id = dr.check_id
     LEFT JOIN ${SCHEMA}.clients cl ON cl.code = c.client_code
     WHERE dr.status = 'pending'
     ORDER BY dr.created_at DESC`
  ).catch(() => []);

  const requests = rows.map((r: any) => ({
    id:                r.id,
    check_id:          r.check_id,
    event_id:          r.event_id,
    target_type:       r.target_type,
    reason:            r.reason,
    requested_by:      r.requested_by,
    requested_by_name: r.requested_by_name || r.requested_by || '—',
    status:            r.status,
    created_at:        r.created_at,
    _check: {
      checkNo:    r.check_no ?? '',
      checkDate:  r.check_date ?? null,
      bank:       r.bank ?? '',
      client:     r.client_code ?? '',
      clientName: r.client_name ?? r.client_code ?? r.check_id,
    },
  }));

  return NextResponse.json({ ok: true, requests });
}

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canManageUsers(guard.perms)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const requestId = body.requestId || body.id;
    const action = body.action; // action: 'approve' | 'reject'
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
      } else if (req_.check_id) {
        await softDeleteCheck(req_.check_id, guard.ctx.user.email, guard.ctx.user.fullName);
      }
    }

    await query(
      `UPDATE ${SCHEMA}.delete_requests SET status = $1 WHERE id = $2`,
      [action === "approve" ? "approved" : "rejected", requestId]
    );

    invalidateCache();
    return NextResponse.json({ ok: true, [action]: true });
  } catch (err: any) {
    console.error("POST /api/checks/delete-requests failed:", err);
    return NextResponse.json({ error: err.message || "Failed to process delete request." }, { status: 500 });
  }
}
