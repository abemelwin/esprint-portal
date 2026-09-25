/**
 * catalog-db.ts
 * Shared DB helpers for the sales catalog API routes.
 * Lives outside app/api/ so route files only export HTTP handlers.
 */
import { query } from "@/lib/db";

const S = "sales_portal";

/** Insert all sub-tables for a machine (features, consumables, inclusions, exclusions, add-ons). */
export async function insertSubTables(
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
