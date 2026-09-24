import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { CatalogMachine } from "@/modules/sales/types";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand");
  const condition = searchParams.get("condition");
  const q = searchParams.get("q");

  try {
    let sql = `
      SELECT 
        m.id, m.brand, m.model, m.sub_model, m.unit_condition, m.letterhead,
        m.srp, m.lbp, m.cash_price, m.machine_warranty_months, m.printhead_warranty,
        m.is_active, m.created_at, m.updated_at
      FROM sales_portal.machines m
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

    const rawMachines = await query<Omit<CatalogMachine, "features" | "consumables" | "inclusions" | "exclusions" | "addons" | "product_info_links">>(sql, params);

    // Fetch features, consumables, inclusions, links for all machines
    const machineIds = rawMachines.map((m) => m.id);
    let features: { machine_id: string; description: string }[] = [];
    let consumables: { machine_id: string; item_name: string; package_description?: string; default_price: number }[] = [];
    let inclusions: { machine_id: string; description: string }[] = [];
    let exclusions: { machine_id: string; description: string }[] = [];
    let addons: { machine_id: string; description: string }[] = [];
    let links: { machine_id: string; display_name: string; url: string; document_type: string }[] = [];

    if (machineIds.length > 0) {
      const [fRows, cRows, iRows, eRows, aRows, lRows] = await Promise.all([
        query<{ machine_id: string; description: string }>(
          `SELECT machine_id, description FROM sales_portal.machine_features WHERE machine_id = ANY($1) ORDER BY sort_order`,
          [machineIds]
        ),
        query<{ machine_id: string; item_name: string; package_description?: string; default_price: number }>(
          `SELECT machine_id, item_name, package_description, default_price FROM sales_portal.machine_consumables WHERE machine_id = ANY($1) ORDER BY sort_order`,
          [machineIds]
        ),
        query<{ machine_id: string; description: string }>(
          `SELECT machine_id, description FROM sales_portal.machine_inclusions WHERE machine_id = ANY($1) ORDER BY sort_order`,
          [machineIds]
        ),
        query<{ machine_id: string; description: string }>(
          `SELECT machine_id, description FROM sales_portal.machine_exclusions WHERE machine_id = ANY($1) ORDER BY sort_order`,
          [machineIds]
        ),
        query<{ machine_id: string; description: string }>(
          `SELECT machine_id, description FROM sales_portal.machine_addons WHERE machine_id = ANY($1) ORDER BY sort_order`,
          [machineIds]
        ),
        query<{ machine_id: string; display_name: string; url: string; document_type: string }>(
          `SELECT machine_id, display_name, url, document_type FROM sales_portal.product_info_links WHERE machine_id = ANY($1)`,
          [machineIds]
        ),
      ]);

      features = fRows;
      consumables = cRows;
      inclusions = iRows;
      exclusions = eRows;
      addons = aRows;
      links = lRows;
    }

    const fullMachines: CatalogMachine[] = rawMachines.map((m) => {
      return {
        ...m,
        srp: Number(m.srp),
        lbp: Number(m.lbp),
        cash_price: Number(m.cash_price),
        features: features.filter((f) => f.machine_id === m.id).map((f) => f.description),
        consumables: consumables.filter((c) => c.machine_id === m.id),
        inclusions: inclusions.filter((i) => i.machine_id === m.id).map((i) => i.description),
        exclusions: exclusions.filter((e) => e.machine_id === m.id).map((e) => e.description),
        addons: addons.filter((a) => a.machine_id === m.id).map((a) => a.description),
        product_info_links: links.filter((l) => l.machine_id === m.id),
      };
    });

    return NextResponse.json({ machines: fullMachines });
  } catch (err) {
    console.error("Error fetching catalog machines:", err);
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
    return NextResponse.json({ error: "Forbidden: Catalog manage permission required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      brand,
      model,
      sub_model,
      unit_condition = "Brand New",
      letterhead = "ES Print Media Inc.",
      srp = 0,
      lbp = 0,
      cash_price = 0,
      machine_warranty_months = 12,
      printhead_warranty = "0",
      features = [],
      consumables = [],
      inclusions = [],
      exclusions = [],
      addons = [],
    } = body;

    if (!brand || !model) {
      return NextResponse.json({ error: "Brand and Model are required" }, { status: 400 });
    }

    const rows = await query<{ id: string }>(
      `
      INSERT INTO sales_portal.machines (
        brand, model, sub_model, unit_condition, letterhead,
        srp, lbp, cash_price, machine_warranty_months, printhead_warranty
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
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
      ]
    );

    const newId = rows[0].id;

    // Insert sub-tables
    if (Array.isArray(features) && features.length > 0) {
      for (let i = 0; i < features.length; i++) {
        await query(
          `INSERT INTO sales_portal.machine_features (machine_id, description, sort_order) VALUES ($1, $2, $3)`,
          [newId, features[i], i]
        );
      }
    }

    if (Array.isArray(consumables) && consumables.length > 0) {
      for (let i = 0; i < consumables.length; i++) {
        const c = consumables[i];
        await query(
          `INSERT INTO sales_portal.machine_consumables (machine_id, item_name, package_description, default_price, sort_order) VALUES ($1, $2, $3, $4, $5)`,
          [newId, c.item_name, c.package_description || null, c.default_price || 0, i]
        );
      }
    }

    if (Array.isArray(inclusions) && inclusions.length > 0) {
      for (let i = 0; i < inclusions.length; i++) {
        await query(
          `INSERT INTO sales_portal.machine_inclusions (machine_id, description, sort_order) VALUES ($1, $2, $3)`,
          [newId, inclusions[i], i]
        );
      }
    }

    return NextResponse.json({ success: true, id: newId }, { status: 201 });
  } catch (err) {
    console.error("Error creating catalog machine:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
