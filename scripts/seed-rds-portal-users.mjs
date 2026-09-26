/**
 * seed-rds-portal-users.mjs
 *
 * Populates AWS RDS PostgreSQL `portal_users` and `module_access` tables
 * with the 75 sales portal users from .sales-users-from-supabase.json.
 *
 * Usage: node scripts/seed-rds-portal-users.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = readEnv(path.resolve(__dirname, "..", ".env.local"));

if (!env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const jsonPath = path.resolve(__dirname, "..", ".sales-users-from-supabase.json");
if (!fs.existsSync(jsonPath)) {
  console.error(".sales-users-from-supabase.json not found");
  process.exit(1);
}

const usersData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
console.log(`Loaded ${usersData.length} users from JSON.`);

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let userCount = 0;
    let accessCount = 0;

    for (const u of usersData) {
      const email = (u.email || "").trim().toLowerCase();
      if (!email) continue;

      const fullName = u.display_name || email.split("@")[0] || "";
      const portalRole = u.role === "superadmin" || u.role === "admin" ? "super_admin" : "user";
      const isActive = u.is_active !== false;

      // Upsert into portal_users
      const resUser = await client.query(
        `INSERT INTO public.portal_users (email, full_name, portal_role, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             portal_role = EXCLUDED.portal_role,
             is_active = EXCLUDED.is_active,
             updated_at = NOW()
         RETURNING id`,
        [email, fullName, portalRole, isActive]
      );

      const userId = resUser.rows[0].id;
      userCount++;

      // Upsert into module_access for sales
      const roleMap = {
        superadmin: "Admin",
        admin: "Admin",
        product_development_manager: "product_manager",
        product_technical_head: "product_manager",
        sales_admin_manager: "sales_admin_manager",
        sales_admin_supervisor: "sales_admin_supervisor",
        sales_admin: "sales_admin_assistant",
        sales_admin_assistant: "sales_admin_assistant",
        area_sales_manager: "area_sales_manager",
        account_executive: "account_executive",
        sales_assistant: "sales_assistant",
        service_manager: "service_manager",
      };

      const salesRole = roleMap[u.role] || u.role || "account_executive";
      const isModuleAdmin = ["Admin", "superadmin", "sales_admin_manager"].includes(u.role);

      await client.query(
        `INSERT INTO public.module_access (user_id, module, module_role, is_module_admin)
         VALUES ($1, 'sales', $2, $3)
         ON CONFLICT (user_id, module) DO UPDATE
         SET module_role = EXCLUDED.module_role,
             is_module_admin = EXCLUDED.is_module_admin,
             updated_at = NOW()`,
        [userId, salesRole, isModuleAdmin]
      );

      accessCount++;
    }

    await client.query("COMMIT");
    console.log(`Successfully seeded AWS RDS: ${userCount} portal_users, ${accessCount} sales module_access entries.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seeding error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
