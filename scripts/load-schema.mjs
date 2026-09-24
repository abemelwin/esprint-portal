/**
 * load-schema.mjs
 *
 * Runs the SQL schema files against the RDS database in order.
 * Run this ONCE after RDS is available, before importing data.
 *
 * Usage: node scripts/load-schema.mjs
 */

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA_FILES = [
  "db/schema/00_portal_core.sql",
  "db/schema/01_check_monitoring.sql",
  "db/schema/02_machine_monitoring.sql",
  "db/schema/03_sales_portal.sql",
];

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connected to RDS. Loading schema files...\n");
    for (const file of SCHEMA_FILES) {
      const sql = readFileSync(join(__dirname, "..", file), "utf8");
      process.stdout.write(`  Running ${file}... `);
      await client.query(sql);
      console.log("done");
    }
    console.log("\n✅ Schema loaded successfully.");

    // List created tables
    const res = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'check_monitoring', 'machine_monitoring', 'sales_portal')
      ORDER BY table_schema, table_name
    `);
    console.log("\nTables created:");
    for (const row of res.rows) {
      console.log(`  ${row.table_schema}.${row.table_name}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Schema load failed:", e.message);
  process.exit(1);
});
