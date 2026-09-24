/**
 * /api/attachments/[clientCode]/[filename]
 *   DELETE — remove a file for a client.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCheckAccess } from "@/modules/checks/lib/api-guard";
import { canCreate } from "@/modules/checks/lib/permissions";
import { deleteAttachment } from "@/lib/attachments";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ clientCode: string; filename: string }> }
) {
  const guard = await requireCheckAccess();
  if (!guard.ok) return guard.response;
  if (!canCreate(guard.perms)) {
    return NextResponse.json({ ok: false, error: "Your role cannot delete files." }, { status: 403 });
  }

  const { clientCode, filename } = await context.params;
  try {
    await deleteAttachment(clientCode, decodeURIComponent(filename));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete attachment failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
