/**
 * migrate-schedule.mjs
 *
 * Migrates recon_schedule rows from Supabase → RDS.
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

const H = {apikey:cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY};

// Fetch all schedule rows (paginated)
const rows = [];
let offset = 0;
for(;;){
  const r = await fetch(`${cmEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/recon_schedule?select=*&order=sort_order.asc&limit=1000&offset=${offset}`,{headers:H});
  const d = await r.json();
  if(!Array.isArray(d)||d.length===0) break;
  rows.push(...d);
  if(d.length<1000) break;
  offset+=1000;
}
console.log('Supabase recon_schedule rows:', rows.length);

const c = new pg.Client({connectionString:portalEnv.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const S='check_monitoring';

const {rows:existing} = await c.query(`SELECT id FROM ${S}.recon_schedule`);
const existingIds = new Set(existing.map(r=>r.id));
const newRows = rows.filter(r=>!existingIds.has(r.id));
console.log('New rows to insert:', newRows.length);

if (COMMIT && newRows.length>0) {
  for (const r of newRows) {
    await c.query(
      `INSERT INTO ${S}.recon_schedule
        (id, client_code, schedule_date, monthly_amortization, amount, payment_details, sort_order, event_id, check_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.client_code, r.schedule_date ?? null, r.monthly_amortization ?? null,
       r.amount ?? null, r.payment_details ?? null, r.sort_order ?? 0,
       r.event_id ?? null, r.check_id ?? null, r.updated_at ?? new Date().toISOString()]
    );
  }
  console.log(`✅ Inserted ${newRows.length} schedule rows.`);
} else {
  console.log('(DRY RUN — pass --commit to apply)');
}

await c.end();
