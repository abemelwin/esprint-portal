/**
 * GET  /api/sales/product-info/[machineId]  — list product_info_links for a machine
 * POST /api/sales/product-info/[machineId]  — add a new link (catalog managers only)
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";

const S = "sales_portal";

export async function GET(
  _req: NextRequest,
  { params }: { params: { machineId: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await query(
      `SELECT id, machine_id, display_name, url, document_type, created_at
       FROM ${S}.product_info_links WHERE machine_id = $1 ORDER BY created_at`,
      [params.machineId]
    );
    return NextResponse.json({ links: rows });
  } catch (err) {
    console.error("GET /api/sales/product-info error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { machineId: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const perms = getSalesPermissions(user);
  if (!perms.canManageProductFiles) {
    return NextResponse.json({ error: "Forbidden: product file permission required" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { display_name, url, document_type = "other" } = body;
    if (!display_name?.trim() || !url?.trim()) {
      return NextResponse.json({ error: "display_name and url are required" }, { status: 400 });
    }
    const rows = await query(
      `INSERT INTO ${S}.product_info_links (id, machine_id, display_name, url, document_type)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [randomUUID(), params.machineId, display_name.trim(), url.trim(), document_type]
    );
    return NextResponse.json({ ok: true, link: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sales/product-info error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
