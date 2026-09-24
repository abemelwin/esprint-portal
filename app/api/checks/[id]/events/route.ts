/**
 * /api/checks/[id]/events
 *   POST — append an event (HOLD_REQUEST, RETURN, PARTIAL_PAYMENT,
 *          DEPOSIT_CLEARED, SETTLED_PAID, RECONSTRUCT, REPLACEMENT, ...)
 *          to a check's ledger.
 *
 * Requires an EDIT role and that the check is within the user's scope.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canEdit, canSeeCheck } from "@/modules/checks/lib/permissions";
import {
  getCheckWithEvents,
  insertEvent,
  invalidateCache,
} from "@/modules/checks/lib/data";
import type { CheckEvent, EventType } from "@/modules/checks/lib/database.types";

const VALID_TYPES: EventType[] = [
  "HOLD_REQUEST", "RETURN", "DEPOSITED", "DEPOSIT_CLEARED", "REPLACEMENT",
  "PARTIAL_PAYMENT", "SETTLED_PAID", "CANCELLATION", "ALTERATION", "LEGAL",
  "RECONSTRUCT", "BAD_ACCOUNT", "NOTE",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  if (!canEdit(guard.perms)) {
    return NextResponse.json(
      { error: "Your role cannot record events." },
      { status: 403 }
    );
  }

  const { check: existing } = await getCheckWithEvents(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Check not found." }, { status: 404 });
  }
  if (!canSeeCheck(guard.perms, { branch: existing.branch, ae: existing.ae })) {
    return NextResponse.json(
      { error: "This check is outside your assigned scope." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `Invalid event type: ${body.type}` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const event: CheckEvent = {
    id: typeof body.id === "string" && body.id ? body.id : randomUUID(),
    checkId: params.id,
    type: body.type as EventType,
    eventDate: body.eventDate ?? now.slice(0, 10),
    moveDate: body.moveDate ?? null,
    reason: body.reason ?? null,
    method: body.method ?? null,
    reference: body.reference ?? null,
    amount: body.amount != null ? Number(body.amount) : undefined,
    notes: body.notes ?? "",
    recordedBy: guard.ctx.user.email,
    recordedAt: now,
  };

  try {
    await insertEvent(event);

    // ── Auto-add to bad_account_list on a BLACKLIST cancellation ──────────
    // When a check is cancelled with reason BLACKLIST, automatically create a
    // BLACKLIST entry in the bad account monitoring list using the check's
    // client info. Mirrors the original system (esprint-check-monitoring
    // app/actions/data.ts addEvent). Silent on failure so it never blocks the
    // event save.
    if (event.type === "CANCELLATION" && event.reason?.toUpperCase() === "BLACKLIST") {
      try {
        const { query } = await import("@/lib/db");
        const SCHEMA = "check_monitoring";
        const cl = await query(
          `SELECT name FROM ${SCHEMA}.clients WHERE code = $1 LIMIT 1`,
          [existing.client]
        );
        const clientName = (cl[0]?.name as string | undefined) ?? existing.client;
        // Only insert if this client isn't already blacklisted (avoid duplicates)
        const dupe = await query(
          `SELECT id FROM ${SCHEMA}.bad_account_list
             WHERE client_name = $1 AND status = 'BLACKLIST' LIMIT 1`,
          [clientName]
        );
        if (dupe.length === 0) {
          await query(
            `INSERT INTO ${SCHEMA}.bad_account_list
               (id, ae, branch_id, client_name, status, notes, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,'BLACKLIST',$5,$6, now(), now())`,
            [
              randomUUID(),
              existing.ae ?? null,
              existing.branch ?? null,
              clientName,
              `Auto-added from Write-off / Blacklist cancellation on check ${params.id}`,
              guard.ctx.user.email,
            ]
          );
        }
      } catch (autoErr) {
        // Silent — don't block the event save if the auto-add fails
        console.error("BLACKLIST auto-add to bad_account_list failed:", autoErr);
      }
    }

    invalidateCache();
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    console.error("POST /api/checks/[id]/events failed:", err);
    return NextResponse.json({ error: "Failed to record event." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canEdit(guard.perms)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.eventId) return NextResponse.json({ error: "eventId required." }, { status: 400 });

  const { query } = await import("@/lib/db");
  await query(
    `UPDATE check_monitoring.events SET
       event_date = $2, move_date = $3, reason = $4,
       amount = $5, notes = $6, method = $7, reference = $8
     WHERE id = $1 AND check_id = $9`,
    [body.eventId, body.eventDate, body.moveDate, body.reason,
     body.amount ?? null, body.notes ?? '', body.method ?? null,
     body.reference ?? null, params.id]
  );
  invalidateCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canEdit(guard.perms)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.eventId) return NextResponse.json({ error: "eventId required." }, { status: 400 });

  const { query } = await import("@/lib/db");
  await query(`DELETE FROM check_monitoring.events WHERE id = $1 AND check_id = $2`, [body.eventId, params.id]);
  invalidateCache();
  return NextResponse.json({ ok: true });
}
