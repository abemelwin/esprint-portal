/**
 * POST /api/checks/[id]/move-partial
 *
 * Moves a PARTIAL_PAYMENT event from one check to another:
 * 1. Deletes the partial from source (balance reverts).
 * 2. Creates the same PARTIAL_PAYMENT on the target.
 * 3. Logs a NOTE on source and target for the audit trail.
 *
 * Adapted from esprint-check-monitoring for AWS RDS (plain pg).
 * Body: { eventId, targetCheckId }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canEdit } from "@/modules/checks/lib/permissions";
import { query, transaction } from "@/lib/db";
import { invalidateCache } from "@/modules/checks/lib/data";

const SCHEMA = "check_monitoring";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canEdit(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot move payments." }, { status: 403 });
  }

  const sourceCheckId = params.id;
  const body = await req.json().catch(() => ({}));
  const { eventId, targetCheckId } = body;

  const byName = guard.ctx.user.fullName || guard.ctx.user.email;
  const byId = guard.ctx.user.email;

  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required" }, { status: 400 });
  if (!targetCheckId) return NextResponse.json({ ok: false, error: "targetCheckId is required" }, { status: 400 });
  if (targetCheckId === sourceCheckId) {
    return NextResponse.json({ ok: false, error: "Target must differ from source" }, { status: 400 });
  }

  // Fetch the event to move
  const evRows = await query<{
    id: string; type: string; event_date: string | null; reason: string | null;
    method: string | null; reference: string | null; amount: number | null; notes: string | null;
  }>(
    `SELECT * FROM ${SCHEMA}.events WHERE id = $1 AND check_id = $2`,
    [eventId, sourceCheckId]
  );
  const ev = evRows[0];
  if (!ev) return NextResponse.json({ ok: false, error: "Partial payment event not found" }, { status: 404 });
  if (ev.type !== "PARTIAL_PAYMENT") {
    return NextResponse.json({ ok: false, error: "Event is not a partial payment" }, { status: 400 });
  }

  // Fetch source + target check info for log messages
  const [srcRows, tgtRows] = await Promise.all([
    query<{ check_no: string; client_code: string }>(`SELECT check_no, client_code FROM ${SCHEMA}.checks WHERE id = $1`, [sourceCheckId]),
    query<{ check_no: string; client_code: string }>(`SELECT check_no, client_code FROM ${SCHEMA}.checks WHERE id = $1`, [targetCheckId]),
  ]);
  const src = srcRows[0];
  const tgt = tgtRows[0];
  if (!tgt) return NextResponse.json({ ok: false, error: "Target check not found" }, { status: 404 });

  const amount = ev.amount ?? 0;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const amtStr = Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 });

  try {
    await transaction(async (client) => {
      // 1. Delete partial from source
      await client.query(`DELETE FROM ${SCHEMA}.events WHERE id = $1`, [eventId]);

      // 2. Insert partial on target
      await client.query(
        `INSERT INTO ${SCHEMA}.events
           (id, check_id, type, event_date, move_date, reason, method, reference, amount, notes, recorded_by, recorded_at)
         VALUES ($1,$2,'PARTIAL_PAYMENT',$3,NULL,$4,$5,$6,$7,$8,$9,$10)`,
        [randomUUID(), targetCheckId, ev.event_date ?? today, ev.reason, ev.method, ev.reference, amount, ev.notes ?? "", byId, now]
      );

      // 3. NOTE on source
      await client.query(
        `INSERT INTO ${SCHEMA}.events
           (id, check_id, type, event_date, reason, notes, recorded_by, recorded_at)
         VALUES ($1,$2,'NOTE',$3,$4,$5,$6,$7)`,
        [randomUUID(), sourceCheckId, today,
         `Moved partial ₱${amtStr} to check ${tgt.check_no} (${tgt.client_code})`, `Moved by ${byName}`, byId, now]
      );

      // 4. NOTE on target
      await client.query(
        `INSERT INTO ${SCHEMA}.events
           (id, check_id, type, event_date, reason, notes, recorded_by, recorded_at)
         VALUES ($1,$2,'NOTE',$3,$4,$5,$6,$7)`,
        [randomUUID(), targetCheckId, today,
         `Received partial ₱${amtStr} from check ${src?.check_no ?? sourceCheckId} (${src?.client_code ?? ""})`, `Moved by ${byName}`, byId, now]
      );
    });
    invalidateCache();
    return NextResponse.json({ ok: true, movedAmount: amount, targetCheckId });
  } catch (err) {
    console.error("move-partial failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to move partial payment." }, { status: 500 });
  }
}
