import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { StockSummaryRow, ReorderPoint } from "@/modules/machines/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get raw counts from machines table
    const machineCounts = await query<{
      brand: string;
      model: string;
      in_stock: string;
      recertified: string;
      demo: string;
      reserved: string;
      incoming: string;
    }>(`
      SELECT 
        COALESCE(brand, 'Unbranded') as brand,
        model,
        COUNT(*) FILTER (WHERE status = 'In Stock') as in_stock,
        COUNT(*) FILTER (WHERE status = 'Recertified') as recertified,
        COUNT(*) FILTER (WHERE status = 'Demo') as demo,
        COUNT(*) FILTER (WHERE status = 'Reserved') as reserved,
        COUNT(*) FILTER (WHERE status = 'Incoming') as incoming
      FROM machine_monitoring.machines
      GROUP BY COALESCE(brand, 'Unbranded'), model
      ORDER BY brand, model
    `);

    // 2. Get TBA counts
    const tbaCounts = await query<{
      brand: string;
      model: string;
      tba_count: string;
    }>(`
      SELECT 
        COALESCE(brand, 'Unbranded') as brand,
        model,
        COUNT(*) as tba_count
      FROM machine_monitoring.tba_list
      GROUP BY COALESCE(brand, 'Unbranded'), model
    `);

    // 3. Get reorder points
    const reorders = await query<ReorderPoint>(`
      SELECT id, brand, model, quantity
      FROM machine_monitoring.reorder_points
    `);

    const reorderMap = new Map<string, number>();
    for (const r of reorders) {
      reorderMap.set(`${r.brand}:::${r.model}`.toLowerCase(), Number(r.quantity));
    }

    const tbaMap = new Map<string, number>();
    for (const t of tbaCounts) {
      tbaMap.set(`${t.brand}:::${t.model}`.toLowerCase(), Number(t.tba_count));
    }

    // Merge into StockSummaryRow array
    const stockMatrix: StockSummaryRow[] = machineCounts.map((m) => {
      const key = `${m.brand}:::${m.model}`.toLowerCase();
      const inStock = Number(m.in_stock || 0);
      const recert = Number(m.recertified || 0);
      const demo = Number(m.demo || 0);
      const reserved = Number(m.reserved || 0);
      const incoming = Number(m.incoming || 0);
      const tbaCount = tbaMap.get(key) || 0;
      const reorderPoint = reorderMap.get(key) || 0;

      const totalAvailable = inStock + recert;
      let statusAlert: "critical" | "low" | "ok" = "ok";
      if (reorderPoint > 0) {
        if (totalAvailable === 0) {
          statusAlert = "critical";
        } else if (totalAvailable <= reorderPoint) {
          statusAlert = "low";
        }
      }

      return {
        brand: m.brand,
        model: m.model,
        in_stock: inStock,
        recertified: recert,
        demo: demo,
        reserved: reserved,
        incoming: incoming,
        tba_count: tbaCount,
        total_available: totalAvailable,
        reorder_point: reorderPoint,
        status_alert: statusAlert,
      };
    });

    return NextResponse.json({ stock: stockMatrix, reorderPoints: reorders });
  } catch (err) {
    console.error("Error generating stock summary:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
