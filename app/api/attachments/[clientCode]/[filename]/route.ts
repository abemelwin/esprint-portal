/**
 * /api/attachments/[clientCode]/[filename]
 *   DELETE — remove a file. The full S3 key is passed as ?path=<key>
 *            (from the list result) so we delete the exact object.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { deleteAttachment } from "@/lib/attachments";

export async function DELETE(
  req: NextRequest,
  _context: { params: Promise<{ clientCode: string; filename: string }> }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot delete files." }, { status: 403 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ ok: false, error: "Missing file path." }, { status: 400 });
  }

  try {
    await deleteAttachment(decodeURIComponent(path));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete attachment failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
