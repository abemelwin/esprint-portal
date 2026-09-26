/**
 * seed-rds-scheduler.mjs
 *
 * Applies 04_support_scheduler.sql schema on AWS RDS PostgreSQL database
 * and seeds all branches, staff, jobs, and user approvals from .scheduler-data-from-supabase.json.
 *
 * Usage: node scripts/seed-rds-scheduler.mjs
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

const jsonPath = path.resolve(__dirname, "..", ".scheduler-data-from-supabase.json");
if (!fs.existsSync(jsonPath)) {
  console.error(".scheduler-data-from-supabase.json not found");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
console.log(`Loaded scheduler data from JSON:
  Branches: ${data.branches?.length ?? 0}
  Staff:    ${data.staff?.length ?? 0}
  Jobs:     ${data.jobs?.length ?? 0}
  Users:    ${data.app_users?.length ?? 0}`);

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Apply Schema
    const sqlPath = path.resolve(__dirname, "../db/schema/04_support_scheduler.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");
    await client.query(sqlContent);
    console.log("Schema '04_support_scheduler.sql' applied successfully.");

    // 2. Insert Branches
    let bCount = 0;
    for (const b of data.branches ?? []) {
      await client.query(
        `INSERT INTO scheduler.branches (id, name, note)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, note = EXCLUDED.note`,
        [b.id, b.name, b.note || ""]
      );
      bCount++;
    }
    console.log(`Seeded ${bCount} branches.`);

    // 3. Insert Staff
    let sCount = 0;
    for (const s of data.staff ?? []) {
      await client.query(
        `INSERT INTO scheduler.staff (id, name, role, home_branch_id, hotline)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           home_branch_id = EXCLUDED.home_branch_id,
           hotline = EXCLUDED.hotline`,
        [s.id, s.name, s.role, s.home_branch_id || null, !!s.hotline]
      );
      sCount++;
    }
    console.log(`Seeded ${sCount} staff members.`);

    // 4. Insert Jobs
    let jCount = 0;
    for (const j of data.jobs ?? []) {
      await client.query(
        `INSERT INTO scheduler.jobs (id, date, jt_no, staff_id, branch_id, customer, location, type, type_other, status, status_note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           date = EXCLUDED.date,
           jt_no = EXCLUDED.jt_no,
           staff_id = EXCLUDED.staff_id,
           branch_id = EXCLUDED.branch_id,
           customer = EXCLUDED.customer,
           location = EXCLUDED.location,
           type = EXCLUDED.type,
           type_other = EXCLUDED.type_other,
           status = EXCLUDED.status,
           status_note = EXCLUDED.status_note`,
        [
          j.id,
          j.date,
          j.jt_no,
          j.staff_id || null,
          j.branch_id || null,
          j.customer || "",
          j.location || "",
          j.type,
          j.type_other || null,
          j.status || "pending",
          j.status_note || null,
          j.created_at ? new Date(j.created_at) : new Date(),
        ]
      );
      jCount++;
    }
    console.log(`Seeded ${jCount} jobs.`);

    // 5. Insert App Users / Approvals
    let uCount = 0;
    for (const u of data.app_users ?? []) {
      await client.query(
        `INSERT INTO scheduler.registration_approvals (id, auth_id, name, email, role, branch_ids, can_edit, is_active, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           branch_ids = EXCLUDED.branch_ids,
           can_edit = EXCLUDED.can_edit,
           is_active = EXCLUDED.is_active,
           is_approved = EXCLUDED.is_approved`,
        [
          u.id,
          u.auth_id || null,
          u.name,
          u.email,
          u.role || "branch",
          u.branch_ids || [],
          u.can_edit !== false,
          u.is_active !== false,
          u.is_approved !== false,
        ]
      );
      uCount++;
    }
    console.log(`Seeded ${uCount} app user approvals.`);

    await client.query("COMMIT");
    console.log("SUCCESS! All Support Scheduler data migrated to AWS RDS PostgreSQL!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
