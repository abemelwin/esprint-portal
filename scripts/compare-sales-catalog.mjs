/**
 * compare-sales-catalog.mjs
 * Compares machines in the Sales Portal Supabase vs portal RDS.
 * Shows: total counts, machines in SB but not in RDS, and vice versa.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readEnv = (p) => Object.fromEntries(
  fs.readFileSync(p, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const portalEnv = readEnv(path.resolve(__dirname, '../.env.local'));
const spEnv     = readEnv(path.resolve(__dirname, '../../Sales Portal/.env'));

const SB  = spEnv.VITE_SUPABASE_URL;
const KEY = spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const H   = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// ── Fetch from Supabase ──
async function sbAll(table, select='*', order='created_at') {
  const all = []; let off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/${table}?select=${select}&order=${order}.asc&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || d.length === 0) break;
    all.push(...d); if (d.length < 1000) break; off += 1000;
  }
  return all;
}

// ── Fetch from RDS ──
const client = new pg.Client({ connectionString: portalEnv.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const S = 'sales_portal';

const [sbMachines, rdsMachinesRes] = await Promise.all([
  sbAll('machines', 'id,brand,model,sub_model,is_active'),
  client.query(`SELECT id, brand, model, sub_model FROM ${S}.machines`),
]);

const sbActive   = sbMachines.filter(m => m.is_active !== false);
const rdsSet     = new Map(rdsMachinesRes.rows.map(m => [`${m.brand}|${m.model}|${m.sub_model||''}`, m]));
const sbSet      = new Map(sbActive.map(m => [`${m.brand}|${m.model}|${m.sub_model||''}`, m]));

const onlySB     = sbActive.filter(m => !rdsSet.has(`${m.brand}|${m.model}|${m.sub_model||''}`));
const onlyRDS    = rdsMachinesRes.rows.filter(m => !sbSet.has(`${m.brand}|${m.model}|${m.sub_model||''}`));

console.log(`Supabase active machines : ${sbActive.length}`);
console.log(`Portal RDS machines      : ${rdsMachinesRes.rows.length}`);
console.log(`Only in Supabase (need migration): ${onlySB.length}`);
console.log(`Only in Portal   (not in SB)    : ${onlyRDS.length}`);

if (onlySB.length > 0) {
  console.log('\nMachines to migrate from Supabase → Portal:');
  onlySB.slice(0, 30).forEach(m => console.log(`  ${m.brand} | ${m.model}`));
  if (onlySB.length > 30) console.log(`  ... and ${onlySB.length - 30} more`);
}

// Also check product_info_links
const sbLinks = await sbAll('product_info_links', 'id,machine_id,display_name,url,document_type');
const rdsLinks = await client.query(`SELECT id FROM ${S}.product_info_links`);
console.log(`\nSupabase product_info_links : ${sbLinks.length}`);
console.log(`Portal RDS product_info_links: ${rdsLinks.rows.length}`);
console.log(`Storage files to migrate     : ${sbLinks.filter(l => !l.url?.startsWith('http')).length} (relative paths in storage)`);
console.log(`External links               : ${sbLinks.filter(l => l.url?.startsWith('http')).length}`);

await client.end();
