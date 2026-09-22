/**
 * /api/checks/[id]
 *   GET    — fetch a single check with its events.
 *   PATCH  — update an existing check's editable fields.
 *   DELETE — soft-delete a check (archive to deleted_checks).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canEdit, canDeleteCheck, canSeeCheck } from "@/modules/checks/lib/permissions";
import {
  getCheckWithEvents,
  updateCheck,
  softDeleteCheck,
  serverLoad,
  invalidateCache,
} from "@/modules/checks/lib/data";
import type { Check } from "@/modules/checks/lib/database.types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const { check, events } = await getCheckWithEvents(params.id);
  if (!check) return NextResponse.json({ error: "Check not found." }, { status: 404 });

  if (!canSeeCheck(guard.perms, { branch: check.branch, ae: check.ae })) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  // Load reference data for the modal (clients, branches, banks).
  const data = await serverLoad({ slim: true });

  return NextResponse.json({ ok: true, check, events, data });
}


export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  if (!canEdit(guard.perms)) {
    return NextResponse.json(
      { error: "Your role cannot edit checks." },
      { status: 403 }
    );
  }

  const { check: existing } = await getCheckWithEvents(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Check not found." }, { status: 404 });
  }
  if (!canSeeCheck(guard.perms, { branch: existing.branch, ae: existing.ae })) {
    return NextResponse.json(
      { error: "You cannot edit a check outside your assigned scope." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Merge editable fields onto the existing check (id/createdBy/createdAt fixed).
  const updated: Check = {
    ...existing,
    client: body.client ?? existing.client,
    branch: body.branch ?? existing.branch,
    subsidiary: body.subsidiary ?? existing.subsidiary,
    ae: body.ae ?? existing.ae,
    bank: body.bank ?? existing.bank,
    checkNo: body.checkNo ?? existing.checkNo,
    checkDate: body.checkDate ?? existing.checkDate,
    originalAmount:
      body.originalAmount != null ? Number(body.originalAmount) : existing.originalAmount,
    paymentFor: body.paymentFor ?? existing.paymentFor,
    paymentDescription: body.paymentDescription ?? existing.paymentDescription,
    notes: body.notes ?? existing.notes,
    finalStatus: body.finalStatus ?? existing.finalStatus,
    blacklistReason: body.blacklistReason ?? existing.blacklistReason,
  };

  try {
    await updateCheck(updated);
    invalidateCache();
    return NextResponse.json({ ok: true, check: updated });
  } catch (err) {
    console.error("PATCH /api/checks/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update check." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  if (!canDeleteCheck(guard.perms)) {
    return NextResponse.json(
      { error: "Only Super Admin or Admin can delete checks." },
      { status: 403 }
    );
  }

  const { check: existing } = await getCheckWithEvents(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Check not found." }, { status: 404 });
  }

  try {
    await softDeleteCheck(params.id, guard.ctx.user.email, guard.ctx.user.fullName);
    invalidateCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/checks/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete check." }, { status: 500 });
  }
}
