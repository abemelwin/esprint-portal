/**
 * list-sales-portal-users.mjs  (READ-ONLY)
 *
 * Lists ALL active users from the Sales Portal Supabase project.
 * Reads from: Sales Portal/.env  (VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.resolve(__dirname, "../../Sales Portal/.env");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8").split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const SB  = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const H   = { apikey: KEY, Authorization: `Bearer ${KEY}` };

if (!SB || !KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in Sales Portal/.env");
  process.exit(1);
}

// Fetch from user_profiles_with_email view (includes email from auth.users)
const res = await fetch(
  `${SB}/rest/v1/user_profiles_with_email?select=user_id,email,display_name,role,is_active,is_sp_member&order=role.asc,display_name.asc&limit=500`,
  { headers: H }
);

if (!res.ok) {
  console.error("Supabase request failed:", res.status, await res.text());
  process.exit(1);
}

const users = await res.json();
const active = users.filter(u => u.is_active && u.is_sp_member !== false);

console.log(`\nFound ${active.length} active sales portal users:\n`);
console.log("EMAIL".padEnd(45), "ROLE".padEnd(28), "NAME");
console.log("-".repeat(100));
for (const u of active) {
  console.log(
    (u.email || "(no email)").padEnd(45),
    (u.role || "user").padEnd(28),
    u.display_name || ""
  );
}

// Output as JSON too for use by migration script
const outPath = path.resolve(__dirname, "../.sales-users-from-supabase.json");
fs.writeFileSync(outPath, JSON.stringify(active, null, 2));
console.log(`\nSaved to .sales-users-from-supabase.json (${active.length} users)`);
