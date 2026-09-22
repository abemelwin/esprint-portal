/**
 * inspect-supabase-user.mjs  (READ-ONLY)
 *
 * Dumps the full user_metadata of a few Supabase users so we can see
 * exactly what fields exist (role, branches, aes, system access, etc.)
 * before building the migration mapping. Makes no changes.
 *
 * Usage: node scripts/inspect-supabase-user.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(
  __dirname, "..", "..", "esprint-check-monitoring", ".env.local"
);

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = readEnv(envPath);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(
  `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=10`,
  { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
);
const data = await res.json();
const users = data.users ?? data;

// Show metadata for a variety of roles so we see all field shapes.
for (const u of users.slice(0, 6)) {
  console.log("─".repeat(70));
  console.log("email:", u.email);
  console.log("user_metadata:", JSON.stringify(u.user_metadata, null, 2));
}
console.log("─".repeat(70));
