/**
 * remove-deleted-checks.mjs
 *
 * Finds checks in RDS that no longer exist in Supabase (were deleted there)
 * and removes them from RDS along with their events and notes.
 *
 * DRY RUN by default. Pass --commit to apply.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = process.argv.includes('--commit');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const cmEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../esprint-check-monitoring/.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));

const H = { apikey: cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY };

// Get all Supabase check IDs (paginated)
const sbIds = new Set();
let offset = 0;
for(;;){
  const r = await fetch(`${cmEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/checks?select=id&limit=1000&offset=${offset}`, { headers: H });
  const d = await r.json();
  if(!Array.isArray(d)||d.length===0) break;
  d.forEach(x => sbIds.add(x.id));
  if(d.length<1000) break;
  offset+=1000;
}
console.log(`Supabase: ${sbIds.size} checks`);

const c = new pg.Client({ connectionString: portalEnv.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const S = 'check_monitoring';

const { rows } = await c.query(`SELECT id, check_no, bank, client_code FROM ${S}.checks`);
const toDelete = rows.filter(r => !sbIds.has(r.id));
console.log(`RDS: ${rows.length} checks`);
console.log(`\nChecks in RDS but NOT in Supabase (${toDelete.length}):`);
toDelete.forEach(x => console.log(' ', x.client_code, x.bank, x.check_no, x.id));

if (COMMIT && toDelete.length > 0) {
  for (const x of toDelete) {
    // Delete events first (FK constraint)
    await c.query(`DELETE FROM ${S}.events WHERE check_id = $1`, [x.id]);
    await c.query(`DELETE FROM ${S}.check_notes WHERE check_id = $1`, [x.id]);
    await c.query(`DELETE FROM ${S}.checks WHERE id = $1`, [x.id]);
    console.log(`  🗑 Deleted check ${x.bank} ${x.check_no} (${x.id})`);
  }
  console.log(`\n✅ Deleted ${toDelete.length} checks from RDS.`);
} else {
  console.log('\n(DRY RUN — pass --commit to apply)');
}

await c.end();
