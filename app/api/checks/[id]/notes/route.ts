/**
 * /api/checks/[id]/notes
 *   GET  — list notes for a check (newest first).
 *   POST — add a note. All roles with module access can write notes.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canWriteNotes } from "@/modules/checks/lib/permissions";
import {
  readCheckNotes,
  saveCheckNote,
  invalidateCache,
} from "@/modules/checks/lib/data";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  try {
    const notes = await readCheckNotes(params.id);
    return NextResponse.json({ ok: true, notes });
  } catch (err) {
    console.error("GET /api/checks/[id]/notes failed:", err);
    return NextResponse.json({ error: "Failed to load notes." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  if (!canWriteNotes(guard.perms)) {
    return NextResponse.json(
      { error: "Your role cannot write notes." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Note content is required." }, { status: 400 });
  }

  try {
    await saveCheckNote({
      id: randomUUID(),
      checkId: params.id,
      content,
      createdBy: guard.ctx.user.email,
      createdByName: guard.ctx.user.fullName,
    });
    invalidateCache();
    const notes = await readCheckNotes(params.id);
    return NextResponse.json({ ok: true, notes });
  } catch (err) {
    console.error("POST /api/checks/[id]/notes failed:", err);
    return NextResponse.json({ error: "Failed to save note." }, { status: 500 });
  }
}
