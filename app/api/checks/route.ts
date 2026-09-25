/**
 * /api/checks
 *   GET  — list checks, optionally filtered by ?replacementOf=<id>
 *   POST — create a new check.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate, canSeeCheck } from "@/modules/checks/lib/permissions";
import { insertCheck, invalidateCache } from "@/modules/checks/lib/data";
import { query } from "@/lib/db";
import type { Check } from "@/modules/checks/lib/database.types";

const SCHEMA = "check_monitoring";

export async function GET(req: NextRequest) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const replacementOf = req.nextUrl.searchParams.get("replacementOf");
  if (replacementOf) {
    const rows = await query<{
      id: string; bank: string | null; check_no: string; final_status: string | null;
    }>(
      `SELECT id, bank, check_no, final_status FROM ${SCHEMA}.checks WHERE replacement_of = $1`,
      [replacementOf]
    );
    const checks = rows.map(r => ({
      id: r.id, bank: r.bank, checkNo: r.check_no, finalStatus: r.final_status,
    }));
    return NextResponse.json({ ok: true, checks });
  }

  return NextResponse.json({ ok: true, checks: [] });
}



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
    createdBy: (guard.ctx.user.fullName && guard.ctx.user.fullName.trim()) || guard.ctx.user.email,
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
