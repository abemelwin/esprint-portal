/**
 * GET  /api/sales/catalog   — list all active machines with sub-tables
 * POST /api/sales/catalog   — create a new machine (admin only)
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { CatalogMachine } from "@/modules/sales/types";

import { insertSubTables } from "@/modules/sales/lib/catalog-db";

const S = "sales_portal";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const brand     = searchParams.get("brand");
  const condition = searchParams.get("condition");
  const q         = searchParams.get("q");

  try {
    // ── Main machine rows — include every catalog column ──────────
    let sql = `
      SELECT
        m.id, m.brand, m.model, m.sub_model, m.unit_condition, m.letterhead,
        m.srp, m.lbp, m.cash_price, m.machine_warranty_months, m.printhead_warranty,
        m.has_trade_in, m.has_printhead, m.has_laser_tube, m.exclude_software_concerns,
        m.service_fee, m.default_months, m.availability, m.image_key,
        m.is_active, m.created_at, m.updated_at
      FROM ${S}.machines m
      WHERE m.is_active = true
    `;
    const params: unknown[] = [];

    if (brand && brand !== "All") {
      params.push(brand);
      sql += ` AND m.brand = $${params.length}`;
    }
    if (condition && condition !== "All") {
      params.push(condition);
      sql += ` AND m.unit_condition = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (m.brand ILIKE $${params.length} OR m.model ILIKE $${params.length})`;
    }

    sql += ` ORDER BY m.brand, m.model`;

    const rawMachines = await query<any>(sql, params);
    const machineIds  = rawMachines.map((m: any) => m.id);

    let features: any[]   = [];
    let consumables: any[] = [];
    let inclusions: any[]  = [];
    let exclusions: any[]  = [];
    let addons: any[]      = [];
    let links: any[]       = [];

    if (machineIds.length > 0) {
      [features, consumables, inclusions, exclusions, addons, links] = await Promise.all([
        query(`SELECT machine_id, description FROM ${S}.machine_features    WHERE machine_id = ANY($1) ORDER BY sort_order`, [machineIds]),
        query(`SELECT machine_id, id, item_name, package_description, default_price FROM ${S}.machine_consumables WHERE machine_id = ANY($1) ORDER BY sort_order`, [machineIds]),
        query(`SELECT machine_id, description FROM ${S}.machine_inclusions  WHERE machine_id = ANY($1) ORDER BY sort_order`, [machineIds]),
        query(`SELECT machine_id, description FROM ${S}.machine_exclusions  WHERE machine_id = ANY($1) ORDER BY sort_order`, [machineIds]),
        query(`SELECT machine_id, description FROM ${S}.machine_addons      WHERE machine_id = ANY($1) ORDER BY sort_order`, [machineIds]),
        query(`SELECT machine_id, id, display_name, url, document_type FROM ${S}.product_info_links WHERE machine_id = ANY($1) ORDER BY created_at`, [machineIds]),
      ]);
    }

    const fullMachines: CatalogMachine[] = rawMachines.map((m: any) => ({
      ...m,
      srp:       Number(m.srp),
      lbp:       Number(m.lbp),
      cash_price: Number(m.cash_price),
      service_fee: Number(m.service_fee ?? 0),
      features:           features.filter((f: any) => f.machine_id === m.id).map((f: any) => f.description),
      consumables:        consumables.filter((c: any) => c.machine_id === m.id).map((c: any) => ({
        id:                  c.id,
        item_name:           c.item_name,
        package_description: c.package_description ?? null,
        default_price:       Number(c.default_price),
      })),
      inclusions:         inclusions.filter((i: any) => i.machine_id === m.id).map((i: any) => i.description),
      exclusions:         exclusions.filter((e: any) => e.machine_id === m.id).map((e: any) => e.description),
      addons:             addons.filter((a: any) => a.machine_id === m.id).map((a: any) => a.description),
      product_info_links: links.filter((l: any) => l.machine_id === m.id),
    }));

    return NextResponse.json({ machines: fullMachines });
  } catch (err) {
    console.error("GET /api/sales/catalog error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const perms = getSalesPermissions(user);
  if (!perms.canManageCatalog) {
    return NextResponse.json({ error: "Forbidden: catalog manage permission required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      brand, model, sub_model,
      unit_condition          = "Brand New",
      letterhead              = "ES Print Media Inc.",
      srp = 0, lbp = 0, cash_price = 0,
      machine_warranty_months = 12,
      printhead_warranty      = "0 mo.",
      has_trade_in            = false,
      has_printhead           = false,
      has_laser_tube          = false,
      exclude_software_concerns = true,
      service_fee             = 0,
      default_months          = 12,
      availability            = null,
      image_key               = null,
      features    = [],
      consumables = [],
      inclusions  = [],
      exclusions  = [],
      addons      = [],
    } = body;

    if (!brand || !model) {
      return NextResponse.json({ error: "Brand and Model are required" }, { status: 400 });
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO ${S}.machines
         (brand, model, sub_model, unit_condition, letterhead,
          srp, lbp, cash_price, machine_warranty_months, printhead_warranty,
          has_trade_in, has_printhead, has_laser_tube, exclude_software_concerns,
          service_fee, default_months, availability, image_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [brand, model, sub_model || null, unit_condition, letterhead,
       srp, lbp, cash_price, machine_warranty_months, printhead_warranty,
       has_trade_in, has_printhead, has_laser_tube, exclude_software_concerns,
       service_fee, default_months, availability || null, image_key || null]
    );

    const newId = rows[0].id;
    await insertSubTables(newId, { features, consumables, inclusions, exclusions, addons });

    return NextResponse.json({ success: true, id: newId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sales/catalog error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Shared helper: insert all sub-tables for a machine — kept for internal use only */
async function insertSubTablesInternal(
  machineId: string,
  data: { features: any[]; consumables: any[]; inclusions: any[]; exclusions: any[]; addons: any[] }
) {
  const { features, consumables, inclusions, exclusions, addons } = data;
  const simpleTable = async (table: string, arr: string[]) => {
    for (let i = 0; i < arr.length; i++) {
      await query(
        `INSERT INTO ${S}.${table} (machine_id, description, sort_order) VALUES ($1,$2,$3)`,
        [machineId, arr[i], i]
      );
    }
  };
  if (Array.isArray(features))   await simpleTable("machine_features",   features);
  if (Array.isArray(inclusions)) await simpleTable("machine_inclusions", inclusions);
  if (Array.isArray(exclusions)) await simpleTable("machine_exclusions", exclusions);
  if (Array.isArray(addons))     await simpleTable("machine_addons",     addons);
  if (Array.isArray(consumables)) {
    for (let i = 0; i < consumables.length; i++) {
      const c = consumables[i];
      await query(
        `INSERT INTO ${S}.machine_consumables (machine_id, item_name, package_description, default_price, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [machineId, c.item_name, c.package_description || null, c.default_price || 0, i]
      );
    }
  }
}
