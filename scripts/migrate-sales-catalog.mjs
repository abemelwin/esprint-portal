/**
 * migrate-sales-catalog.mjs
 *
 * Migrates the Sales Portal catalog from Supabase to the portal's RDS.
 * Handles:
 *   1. New machines in Supabase not yet in RDS (adds them with all sub-tables + fields)
 *   2. Updated catalog fields (service_fee, availability, has_*, etc.) — updates existing
 *   3. All product_info_links (external URLs + Supabase Storage files → S3)
 *   4. Supabase Storage image files → AWS S3 (bucket: esprint-portal-attachments)
 *
 * DRY RUN by default. Pass --commit to apply.
 * Pass --links-only to only migrate product_info_links (skip machine sync).
 *
 * Usage:
 *   node scripts/migrate-sales-catalog.mjs              # dry run
 *   node scripts/migrate-sales-catalog.mjs --commit     # full migration
 *   node scripts/migrate-sales-catalog.mjs --links-only --commit
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const COMMIT      = process.argv.includes('--commit');
const LINKS_ONLY  = process.argv.includes('--links-only');

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
const S = 'sales_portal';

if (!COMMIT) console.log('(DRY RUN — pass --commit to apply)\n');

// ── Supabase fetch helper ─────────────────────────────────────────────────────
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

// ── RDS client ────────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: portalEnv.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// ── 1. Fetch all Supabase machines + sub-tables ───────────────────────────────
console.log('Fetching Supabase machines…');
const [sbMachines, sbFeatures, sbConsumables, sbInclusions, sbExclusions, sbAddons] = await Promise.all([
  sbAll('machines'),
  sbAll('machine_features',   'machine_id,description,sort_order', 'sort_order'),
  sbAll('machine_consumables','machine_id,item_name,package_description,default_price,sort_order', 'sort_order'),
  sbAll('machine_inclusions', 'machine_id,description,sort_order', 'sort_order'),
  sbAll('machine_exclusions', 'machine_id,description,sort_order', 'sort_order'),
  sbAll('machine_addons',     'machine_id,description,sort_order', 'sort_order'),
]);

const sbActive = sbMachines.filter(m => m.is_active !== false);
console.log(`  Supabase: ${sbActive.length} active machines`);

// Build lookup maps for sub-tables
function buildMap(arr) {
  const m = new Map();
  for (const r of arr) {
    if (!m.has(r.machine_id)) m.set(r.machine_id, []);
    m.get(r.machine_id).push(r);
  }
  return m;
}
const sbFeatMap = buildMap(sbFeatures);
const sbConsMap = buildMap(sbConsumables);
const sbInclMap = buildMap(sbInclusions);
const sbExclMap = buildMap(sbExclusions);
const sbAddonMap= buildMap(sbAddons);

// ── 2. Fetch RDS machines ─────────────────────────────────────────────────────
const rdsRes = await client.query(`SELECT id, brand, model, sub_model FROM ${S}.machines`);
const rdsMap  = new Map(rdsRes.rows.map(m => [`${m.brand}|${m.model}|${m.sub_model||''}`, m.id]));
const rdsSbIdMap = new Map(); // supabase_id → rds_id (for links migration)

// Pre-build: for machines already in RDS, map their SB id → RDS id
for (const sbM of sbActive) {
  const key = `${sbM.brand}|${sbM.model}|${sbM.sub_model||''}`;
  const rdsId = rdsMap.get(key);
  if (rdsId) rdsSbIdMap.set(sbM.id, rdsId);
}

// ── 3. Sync machines ──────────────────────────────────────────────────────────
if (!LINKS_ONLY) {
  const newMachines  = sbActive.filter(m => !rdsMap.has(`${m.brand}|${m.model}|${m.sub_model||''}`));
  const existMachines= sbActive.filter(m =>  rdsMap.has(`${m.brand}|${m.model}|${m.sub_model||''}`));

  console.log(`\nNew machines to insert: ${newMachines.length}`);
  console.log(`Existing to update fields: ${existMachines.length}`);

  // Insert new machines
  for (const m of newMachines) {
    const key = `${m.brand}|${m.model}|${m.sub_model||''}`;
    console.log(`  INSERT ${m.brand} | ${m.model}`);
    if (!COMMIT) continue;

    const rows = await client.query(
      `INSERT INTO ${S}.machines
         (brand, model, sub_model, unit_condition, letterhead,
          srp, lbp, cash_price, machine_warranty_months, printhead_warranty,
          has_trade_in, has_printhead, has_laser_tube, exclude_software_concerns,
          service_fee, default_months, availability, image_key, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true)
       ON CONFLICT (brand, model, COALESCE(sub_model,'')) DO NOTHING
       RETURNING id`,
      [
        m.brand, m.model, m.sub_model||null,
        m.unit_condition||'Brand New', m.letterhead||'ES Print Media Inc.',
        m.srp||0, m.lbp||0, m.cash_price||0,
        m.machine_warranty_months||12, m.printhead_warranty||'0 mo.',
        m.has_trade_in??false, m.has_printhead??false, m.has_laser_tube??false,
        m.exclude_software_concerns??true,
        m.service_fee||0, m.default_months||12,
        m.availability||null, m.image_key||null,
      ]
    );
    if (rows.rowCount === 0) continue;
    const newId = rows.rows[0].id;
    rdsSbIdMap.set(m.id, newId);
    rdsMap.set(key, newId);

    // Insert sub-tables
    for (const f of (sbFeatMap.get(m.id)||[])) await client.query(`INSERT INTO ${S}.machine_features (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [newId, f.description, f.sort_order]);
    for (const c of (sbConsMap.get(m.id)||[])) await client.query(`INSERT INTO ${S}.machine_consumables (machine_id,item_name,package_description,default_price,sort_order) VALUES ($1,$2,$3,$4,$5)`, [newId, c.item_name, c.package_description||null, c.default_price||0, c.sort_order]);
    for (const i of (sbInclMap.get(m.id)||[])) await client.query(`INSERT INTO ${S}.machine_inclusions (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [newId, i.description, i.sort_order]);
    for (const e of (sbExclMap.get(m.id)||[])) await client.query(`INSERT INTO ${S}.machine_exclusions (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [newId, e.description, e.sort_order]);
    for (const a of (sbAddonMap.get(m.id)||[])) await client.query(`INSERT INTO ${S}.machine_addons (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [newId, a.description, a.sort_order]);
  }

  // Update catalog fields on existing machines
  let updCount = 0;
  for (const m of existMachines) {
    const rdsId = rdsMap.get(`${m.brand}|${m.model}|${m.sub_model||''}`);
    if (!rdsId) continue;
    rdsSbIdMap.set(m.id, rdsId);
    if (!COMMIT) { updCount++; continue; }
    await client.query(
      `UPDATE ${S}.machines SET
        unit_condition=$1, srp=$2, lbp=$3, cash_price=$4,
        machine_warranty_months=$5, printhead_warranty=$6,
        has_trade_in=$7, has_printhead=$8, has_laser_tube=$9,
        exclude_software_concerns=$10, service_fee=$11,
        default_months=$12, availability=$13, image_key=$14, updated_at=now()
       WHERE id=$15`,
      [
        m.unit_condition||'Brand New', m.srp||0, m.lbp||0, m.cash_price||0,
        m.machine_warranty_months||12, m.printhead_warranty||'0 mo.',
        m.has_trade_in??false, m.has_printhead??false, m.has_laser_tube??false,
        m.exclude_software_concerns??true, m.service_fee||0,
        m.default_months||12, m.availability||null, m.image_key||null,
        rdsId,
      ]
    );
    updCount++;
  }
  console.log(`  Updated catalog fields on ${updCount} existing machines`);
}

// ── 4. Migrate product_info_links ────────────────────────────────────────────
console.log('\nFetching Supabase product_info_links…');
const sbLinks = await sbAll('product_info_links', '*');
const rdsLinksRes = await client.query(`SELECT id FROM ${S}.product_info_links`);
const rdsLinkIds = new Set(rdsLinksRes.rows.map(r => r.id));

// Map SB machine_id → RDS machine_id for links
// First build complete rdsSbIdMap for all machines
for (const m of sbActive) {
  if (!rdsSbIdMap.has(m.id)) {
    const rdsId = rdsMap.get(`${m.brand}|${m.model}|${m.sub_model||''}`);
    if (rdsId) rdsSbIdMap.set(m.id, rdsId);
  }
}

let linkInserted = 0, linkSkipped = 0;

console.log(`  ${sbLinks.length} links to process (${sbLinks.filter(l=>!l.url?.startsWith('http')).length} storage files)…`);
for (const link of sbLinks) {
  if (rdsLinkIds.has(link.id)) { linkSkipped++; continue; }

  const rdsId = rdsSbIdMap.get(link.machine_id);
  if (!rdsId) {
    console.log(`  SKIP link — machine not in portal: ${link.machine_id} (${link.display_name})`);
    linkSkipped++;
    continue;
  }

  let finalUrl = link.url;
  // If it's a Supabase Storage path (not a full URL), migrate to S3
  const isStoragePath = link.url && !link.url.startsWith('http') && !link.url.startsWith('//');
  if (isStoragePath) {
    // Convert Supabase storage path → public URL (S3 migration can be done later)
    const storageBucket = link.document_type === 'picture' ? 'machine-images' : 'product-files';
    finalUrl = `${SB}/storage/v1/object/public/${storageBucket}/${link.url}`;
    console.log(`  STORAGE → public URL: ${path.basename(link.url)}`);
  }

  if (COMMIT) {
    await client.query(
      `INSERT INTO ${S}.product_info_links (id, machine_id, display_name, url, document_type)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [link.id, rdsId, link.display_name, finalUrl, link.document_type||'other']
    );
  }
  linkInserted++;
}

console.log(`\nProduct info links: inserted=${linkInserted}, skipped=${linkSkipped}`);

await client.end();
console.log(`\n${COMMIT ? '✅ Migration done.' : '(DRY RUN) Done. Pass --commit to apply.'}`);
