import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getMachinePermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { LookupData, ReorderPoint } from "@/modules/machines/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [branches, aes, brands, models, reorderPoints] = await Promise.all([
      query<{ id: number; code: string }>(`SELECT id, code FROM machine_monitoring.branches ORDER BY code`),
      query<{ id: number; code: string }>(`SELECT id, code FROM machine_monitoring.aes ORDER BY code`),
      query<{ id: number; name: string }>(`SELECT id, name FROM machine_monitoring.brands ORDER BY name`),
      query<{ id: number; name: string }>(`SELECT id, name FROM machine_monitoring.models ORDER BY name`),
      query<ReorderPoint>(`SELECT id, brand, model, quantity FROM machine_monitoring.reorder_points ORDER BY brand, model`),
    ]);

    const data: LookupData = {
      branches,
      aes,
      brands,
      models,
      reorder_points: reorderPoints,
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching lookups:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getMachinePermissions(user);
  if (!perms.canManageLookups) {
    return NextResponse.json({ error: "Forbidden: Cannot manage lookups" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, type, value, brand, model, quantity, id } = body;

    if (action === "add") {
      if (type === "brand" && value) {
        await query(
          `INSERT INTO machine_monitoring.brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [value.trim()]
        );
      } else if (type === "model" && value) {
        await query(
          `INSERT INTO machine_monitoring.models (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [value.trim()]
        );
      } else if (type === "branch" && value) {
        await query(
          `INSERT INTO machine_monitoring.branches (code) VALUES ($1) ON CONFLICT (code) DO NOTHING`,
          [value.trim().toUpperCase()]
        );
      } else if (type === "ae" && value) {
        await query(
          `INSERT INTO machine_monitoring.aes (code) VALUES ($1) ON CONFLICT (code) DO NOTHING`,
          [value.trim().toUpperCase()]
        );
      } else if (type === "reorder_point" && brand && model && quantity !== undefined) {
        await query(
          `
          INSERT INTO machine_monitoring.reorder_points (brand, model, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (brand, model) DO UPDATE SET quantity = EXCLUDED.quantity
          `,
          [brand, model, Number(quantity)]
        );
      }
    } else if (action === "delete" && id && type) {
      if (type === "brand") {
        await query(`DELETE FROM machine_monitoring.brands WHERE id = $1`, [id]);
      } else if (type === "model") {
        await query(`DELETE FROM machine_monitoring.models WHERE id = $1`, [id]);
      } else if (type === "branch") {
        await query(`DELETE FROM machine_monitoring.branches WHERE id = $1`, [id]);
      } else if (type === "ae") {
        await query(`DELETE FROM machine_monitoring.aes WHERE id = $1`, [id]);
      } else if (type === "reorder_point") {
        await query(`DELETE FROM machine_monitoring.reorder_points WHERE id = $1`, [id]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating lookups:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
