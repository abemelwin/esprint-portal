/**
 * PUT    /api/sales/catalog/[id]  — update machine + all sub-tables (admin only)
 * DELETE /api/sales/catalog/[id]  — soft-delete (sets is_active=false, preserves history)
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import { insertSubTables } from "@/modules/sales/lib/catalog-db";

const S = "sales_portal";

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
      brand, model, sub_model,
      unit_condition, letterhead,
      srp, lbp, cash_price,
      machine_warranty_months, printhead_warranty,
      has_trade_in, has_printhead, has_laser_tube, exclude_software_concerns,
      service_fee, default_months, availability, image_key,
      features, consumables, inclusions, exclusions, addons,
    } = body;

    // Update main row — only set fields that were provided
    await query(
      `UPDATE ${S}.machines SET
        brand                    = COALESCE($1,  brand),
        model                    = COALESCE($2,  model),
        sub_model                = $3,
        unit_condition           = COALESCE($4,  unit_condition),
        letterhead               = COALESCE($5,  letterhead),
        srp                      = COALESCE($6,  srp),
        lbp                      = COALESCE($7,  lbp),
        cash_price               = COALESCE($8,  cash_price),
        machine_warranty_months  = COALESCE($9,  machine_warranty_months),
        printhead_warranty       = COALESCE($10, printhead_warranty),
        has_trade_in             = COALESCE($11, has_trade_in),
        has_printhead            = COALESCE($12, has_printhead),
        has_laser_tube           = COALESCE($13, has_laser_tube),
        exclude_software_concerns = COALESCE($14, exclude_software_concerns),
        service_fee              = COALESCE($15, service_fee),
        default_months           = COALESCE($16, default_months),
        availability             = $17,
        image_key                = $18,
        updated_at               = now()
      WHERE id = $19`,
      [
        brand       ?? null, model    ?? null,
        sub_model   ?? null,
        unit_condition ?? null, letterhead ?? null,
        srp         ?? null, lbp       ?? null, cash_price  ?? null,
        machine_warranty_months ?? null, printhead_warranty ?? null,
        has_trade_in            ?? null, has_printhead      ?? null,
        has_laser_tube          ?? null, exclude_software_concerns ?? null,
        service_fee  ?? null, default_months ?? null,
        availability ?? null, image_key ?? null,
        params.id,
      ]
    );

    // Replace sub-tables atomically (delete → re-insert)
    const subTables = [
      { table: "machine_features",   arr: features },
      { table: "machine_consumables", arr: consumables },
      { table: "machine_inclusions", arr: inclusions },
      { table: "machine_exclusions", arr: exclusions },
      { table: "machine_addons",     arr: addons },
    ];

    for (const { table, arr } of subTables) {
      if (Array.isArray(arr)) {
        await query(`DELETE FROM ${S}.${table} WHERE machine_id = $1`, [params.id]);
      }
    }

    await insertSubTables(params.id, {
      features:    Array.isArray(features)    ? features    : [],
      consumables: Array.isArray(consumables) ? consumables : [],
      inclusions:  Array.isArray(inclusions)  ? inclusions  : [],
      exclusions:  Array.isArray(exclusions)  ? exclusions  : [],
      addons:      Array.isArray(addons)      ? addons      : [],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/sales/catalog/[id] error:", err);
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
    // Soft delete — matches orig `softDeleteMachine` which sets is_active=false
    // so historical quotes referencing this machine still resolve.
    await query(
      `UPDATE ${S}.machines SET is_active = false, updated_at = now() WHERE id = $1`,
      [params.id]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/sales/catalog/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
