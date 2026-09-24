import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getSalesPermissions(user);
  if (!perms.canManageCatalog) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      brand,
      model,
      sub_model,
      unit_condition,
      letterhead,
      srp,
      lbp,
      cash_price,
      machine_warranty_months,
      printhead_warranty,
      features,
      consumables,
      inclusions,
      exclusions,
      addons,
    } = body;

    await query(
      `
      UPDATE sales_portal.machines SET
        brand = $1,
        model = $2,
        sub_model = $3,
        unit_condition = $4,
        letterhead = $5,
        srp = $6,
        lbp = $7,
        cash_price = $8,
        machine_warranty_months = $9,
        printhead_warranty = $10,
        updated_at = NOW()
      WHERE id = $11
      `,
      [
        brand,
        model,
        sub_model || null,
        unit_condition,
        letterhead,
        srp,
        lbp,
        cash_price,
        machine_warranty_months,
        printhead_warranty,
        params.id,
      ]
    );

    // Overwrite sub-tables
    if (Array.isArray(features)) {
      await query(`DELETE FROM sales_portal.machine_features WHERE machine_id = $1`, [params.id]);
      for (let i = 0; i < features.length; i++) {
        await query(
          `INSERT INTO sales_portal.machine_features (machine_id, description, sort_order) VALUES ($1, $2, $3)`,
          [params.id, features[i], i]
        );
      }
    }

    if (Array.isArray(consumables)) {
      await query(`DELETE FROM sales_portal.machine_consumables WHERE machine_id = $1`, [params.id]);
      for (let i = 0; i < consumables.length; i++) {
        const c = consumables[i];
        await query(
          `INSERT INTO sales_portal.machine_consumables (machine_id, item_name, package_description, default_price, sort_order) VALUES ($1, $2, $3, $4, $5)`,
          [params.id, c.item_name, c.package_description || null, c.default_price || 0, i]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating catalog machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getSalesPermissions(user);
  if (!perms.canManageCatalog) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await query(`DELETE FROM sales_portal.machines WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting catalog machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
