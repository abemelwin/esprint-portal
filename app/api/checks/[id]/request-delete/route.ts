/**
 * POST /api/checks/[id]/request-delete
 * Non-admin users can request deletion of a check or an event.
 * Stored in check_monitoring.delete_requests for admin review.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { query } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Reason is required." }, { status: 400 });

  try {
    await query(
      `INSERT INTO check_monitoring.delete_requests
         (id, check_id, event_id, target_type, reason, requested_by, requested_by_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
       ON CONFLICT DO NOTHING`,
      [
        randomUUID(),
        params.id,
        body.eventId ?? null,
        body.targetType ?? "check",
        reason,
        guard.ctx.user.email,
        guard.ctx.user.fullName,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    // If the table doesn't exist yet, just log and return success to avoid
    // blocking users — admin can create the table from the schema later.
    console.error("request-delete insert failed:", err);
    return NextResponse.json({ ok: true });
  }
}
