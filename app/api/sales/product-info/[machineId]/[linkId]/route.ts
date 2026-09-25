/**
 * DELETE /api/sales/product-info/[machineId]/[linkId]  — remove a product info link
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";

const S = "sales_portal";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { machineId: string; linkId: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const perms = getSalesPermissions(user);
  if (!perms.canManageProductFiles) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await query(
      `DELETE FROM ${S}.product_info_links WHERE id = $1 AND machine_id = $2`,
      [params.linkId, params.machineId]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sales/product-info error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
