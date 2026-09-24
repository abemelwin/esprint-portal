/**
 * /api/attachments/[clientCode]
 *   GET  — list all files for a client (with presigned download URLs)
 *   POST — upload a file (multipart/form-data, field "file")
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { listAttachments, uploadAttachment } from "@/lib/attachments";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ clientCode: string }> }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;

  const { clientCode } = await context.params;
  try {
    const files = await listAttachments(clientCode);
    return NextResponse.json({ ok: true, files });
  } catch (err) {
    console.error("List attachments failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ clientCode: string }> }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot upload files." }, { status: 403 });
  }

  const { clientCode } = await context.params;
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });

    const MAX = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX) {
      return NextResponse.json({ ok: false, error: "File too large (max 10 MB)." }, { status: 400 });
    }

    const clientName = String(form.get("clientName") ?? "");
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadAttachment(clientCode, file.name, buffer, file.type || "application/octet-stream", clientName);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Upload attachment failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
