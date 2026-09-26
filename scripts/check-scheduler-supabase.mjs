import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");

const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8").split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const SB = env.NEXT_PUBLIC_SCHEDULER_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SCHEDULER_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

console.log("Checking Supabase URL:", SB);

for (const table of ["branches", "staff", "jobs"]) {
  try {
    const res = await fetch(`${SB}/rest/v1/${table}?select=*`, { headers: H });
    if (res.ok) {
      const data = await res.json();
      console.log(`Table '${table}': ${data.length} rows`);
      if (data.length > 0) {
        console.log(`Sample '${table}':`, JSON.stringify(data[0]));
      }
    } else {
      console.log(`Table '${table}' status: ${res.status}`, await res.text());
    }
  } catch (e) {
    console.error(`Table '${table}' error:`, e.message);
  }
}
