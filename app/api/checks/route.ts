/**
 * /api/checks
 *   POST — create a new check.
 *
 * Body: a Check DTO (see modules/checks/lib/database.types.ts).
 * Requires a role in CREATE_ROLES.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate, canSeeCheck } from "@/modules/checks/lib/permissions";
import { insertCheck, invalidateCache } from "@/modules/checks/lib/data";
import type { Check } from "@/modules/checks/lib/database.types";

export async function POST(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  if (!canCreate(guard.perms)) {
    return NextResponse.json(
      { error: "Your role cannot create checks." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Basic required-field validation (mirrors the original CheckModal).
  const missing = ["client", "branch", "checkNo", "originalAmount"].filter(
    (k) => body[k] === undefined || body[k] === null || body[k] === ""
  );
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Enforce branch/AE scope: a scoped user cannot create a check outside
  // the branches/AEs they are allowed to see.
  if (!canSeeCheck(guard.perms, { branch: String(body.branch), ae: body.ae ?? null })) {
    return NextResponse.json(
      { error: "You cannot create a check outside your assigned branches/AEs." },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const check: Check = {
    id: typeof body.id === "string" && body.id ? body.id : randomUUID(),
    client: String(body.client),
    branch: String(body.branch),
    subsidiary: body.subsidiary ?? null,
    ae: body.ae ?? null,
    bank: body.bank ?? null,
    checkNo: String(body.checkNo),
    checkDate: body.checkDate ?? null,
    originalAmount: Number(body.originalAmount),
    paymentFor: body.paymentFor ?? null,
    paymentDescription: body.paymentDescription ?? "",
    notes: body.notes ?? "",
    finalStatus: body.finalStatus ?? null,
    replacementOf: body.replacementOf ?? null,
    createdBy: guard.ctx.user.email,
    createdAt: now,
    blacklistReason: body.blacklistReason ?? null,
  };

  try {
    await insertCheck(check);
    invalidateCache();
    return NextResponse.json({ ok: true, check });
  } catch (err) {
    console.error("POST /api/checks failed:", err);
    return NextResponse.json({ error: "Failed to create check." }, { status: 500 });
  }
}
