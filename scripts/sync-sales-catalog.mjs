/**
 * sync-sales-catalog.mjs
 *
 * Full sync of Sales Portal catalog: Supabase → RDS.
 * For each machine in Supabase:
 *   - If matched (brand+model+sub_model): UPDATE main fields + DELETE/REINSERT all sub-tables
 *   - If new: INSERT with all sub-tables
 * Machines only in RDS (not in Supabase active) → soft-delete (is_active=false)
 * Product info links: full replace (delete all, re-insert from Supabase)
 *
 * DRY RUN by default. Pass --commit to apply.
 * Usage:
 *   node scripts/sync-sales-catalog.mjs
 *   node scripts/sync-sales-catalog.mjs --commit
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

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
const S   = 'sales_portal';

if (!COMMIT) console.log('(DRY RUN — pass --commit to apply)\n');

async function sbAll(table, select='*', order='created_at') {
  const all=[]; let off=0;
  for(;;){
    const r = await fetch(`${SB}/rest/v1/${table}?select=${select}&order=${order}.asc&limit=1000&offset=${off}`,{headers:H});
    const d = await r.json();
    if(!Array.isArray(d)||d.length===0) break;
    all.push(...d); if(d.length<1000) break; off+=1000;
  }
  return all;
}

// ── Fetch from Supabase ───────────────────────────────────────────────────────
console.log('Fetching from Supabase…');
const [sbMachines, sbFeatures, sbConsumables, sbInclusions, sbExclusions, sbAddons, sbLinks] = await Promise.all([
  sbAll('machines'),
  sbAll('machine_features',   'machine_id,description,sort_order', 'sort_order'),
  sbAll('machine_consumables','machine_id,item_name,package_description,default_price,sort_order', 'sort_order'),
  sbAll('machine_inclusions', 'machine_id,description,sort_order', 'sort_order'),
  sbAll('machine_exclusions', 'machine_id,description,sort_order', 'sort_order'),
  sbAll('machine_addons',     'machine_id,description,sort_order', 'sort_order'),
  sbAll('product_info_links', '*'),
]);

const sbActive = sbMachines.filter(m => m.is_active !== false);
console.log(`Supabase: ${sbActive.length} active machines, ${sbLinks.length} links`);

function buildMap(arr, keyFn) {
  const m = new Map();
  for (const r of arr) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}
const sbFeatMap  = buildMap(sbFeatures,   r => r.machine_id);
const sbConsMap  = buildMap(sbConsumables,r => r.machine_id);
const sbInclMap  = buildMap(sbInclusions, r => r.machine_id);
const sbExclMap  = buildMap(sbExclusions, r => r.machine_id);
const sbAddonMap = buildMap(sbAddons,     r => r.machine_id);

// ── Fetch from RDS ────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: portalEnv.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const rdsRes = await client.query(`SELECT id, brand, model, sub_model, is_active FROM ${S}.machines`);
const rdsKeyMap = new Map(rdsRes.rows.map(m => [`${m.brand}|${m.model}|${m.sub_model||''}`, m]));

// ── Sync machines ─────────────────────────────────────────────────────────────
const sbToRds = new Map(); // sb_id → rds_id
let inserted=0, updated=0, softDeleted=0;

for (const m of sbActive) {
  const key = `${m.brand}|${m.model}|${m.sub_model||''}`;
  const rdsM = rdsKeyMap.get(key);

  if (rdsM) {
    // Exists — update main fields + refresh sub-tables
    sbToRds.set(m.id, rdsM.id);
    if (COMMIT) {
      await client.query(
        `UPDATE ${S}.machines SET
          unit_condition=$1, letterhead=$2, srp=$3, lbp=$4, cash_price=$5,
          machine_warranty_months=$6, printhead_warranty=$7,
          has_trade_in=$8, has_printhead=$9, has_laser_tube=$10,
          exclude_software_concerns=$11, service_fee=$12, default_months=$13,
          availability=$14, image_key=$15, is_active=true, updated_at=now()
         WHERE id=$16`,
        [
          m.unit_condition||'Brand New', m.letterhead||'ES Print Media Inc.',
          m.srp||0, m.lbp||0, m.cash_price||0,
          m.machine_warranty_months||12, m.printhead_warranty||'0 mo.',
          m.has_trade_in??false, m.has_printhead??false, m.has_laser_tube??false,
          m.exclude_software_concerns??true, m.service_fee||0, m.default_months||12,
          m.availability||null, m.image_key||null,
          rdsM.id,
        ]
      );
      // Delete + reinsert all sub-tables
      await client.query(`DELETE FROM ${S}.machine_features    WHERE machine_id=$1`, [rdsM.id]);
      await client.query(`DELETE FROM ${S}.machine_consumables WHERE machine_id=$1`, [rdsM.id]);
      await client.query(`DELETE FROM ${S}.machine_inclusions  WHERE machine_id=$1`, [rdsM.id]);
      await client.query(`DELETE FROM ${S}.machine_exclusions  WHERE machine_id=$1`, [rdsM.id]);
      await client.query(`DELETE FROM ${S}.machine_addons      WHERE machine_id=$1`, [rdsM.id]);
      await insertSubTables(client, rdsM.id, m, sbFeatMap, sbConsMap, sbInclMap, sbExclMap, sbAddonMap);
    }
    updated++;
  } else {
    // New machine
    console.log(`  INSERT ${m.brand} | ${m.model}`);
    if (COMMIT) {
      const rows = await client.query(
        `INSERT INTO ${S}.machines
           (brand,model,sub_model,unit_condition,letterhead,srp,lbp,cash_price,
            machine_warranty_months,printhead_warranty,has_trade_in,has_printhead,
            has_laser_tube,exclude_software_concerns,service_fee,default_months,
            availability,image_key,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true)
         ON CONFLICT (brand,model,COALESCE(sub_model,'')) DO NOTHING
         RETURNING id`,
        [
          m.brand, m.model, m.sub_model||null,
          m.unit_condition||'Brand New', m.letterhead||'ES Print Media Inc.',
          m.srp||0, m.lbp||0, m.cash_price||0,
          m.machine_warranty_months||12, m.printhead_warranty||'0 mo.',
          m.has_trade_in??false, m.has_printhead??false, m.has_laser_tube??false,
          m.exclude_software_concerns??true, m.service_fee||0, m.default_months||12,
          m.availability||null, m.image_key||null,
        ]
      );
      if (rows.rowCount > 0) {
        const newId = rows.rows[0].id;
        sbToRds.set(m.id, newId);
        await insertSubTables(client, newId, m, sbFeatMap, sbConsMap, sbInclMap, sbExclMap, sbAddonMap);
      }
    }
    inserted++;
  }
}

// Soft-delete RDS machines not in Supabase active
const sbKeySet = new Set(sbActive.map(m => `${m.brand}|${m.model}|${m.sub_model||''}`));
for (const rdsM of rdsRes.rows) {
  const key = `${rdsM.brand}|${rdsM.model}|${rdsM.sub_model||''}`;
  if (!sbKeySet.has(key) && rdsM.is_active) {
    console.log(`  SOFT-DELETE (not in SB) ${rdsM.brand} | ${rdsM.model}`);
    if (COMMIT) await client.query(`UPDATE ${S}.machines SET is_active=false WHERE id=$1`, [rdsM.id]);
    softDeleted++;
  }
}

console.log(`\nMachines: inserted=${inserted}, updated=${updated}, soft-deleted=${softDeleted}`);

// ── Sync product_info_links ───────────────────────────────────────────────────
// First refresh sbToRds for all active machines (including those already in RDS)
// Build complete sbToRds map
for (const m of sbActive) {
  if (!sbToRds.has(m.id)) {
    const rdsM = rdsKeyMap.get(`${m.brand}|${m.model}|${m.sub_model||''}`);
    if (rdsM) sbToRds.set(m.id, rdsM.id);
  }
}

// Delete all existing links in RDS, then re-insert from Supabase
if (COMMIT) {
  await client.query(`DELETE FROM ${S}.product_info_links`);
}
let linksInserted=0, linksSkipped=0;
for (const link of sbLinks) {
  const rdsId = sbToRds.get(link.machine_id);
  if (!rdsId) { linksSkipped++; continue; }

  // Convert Supabase storage path → public URL
  let url = link.url;
  if (url && !url.startsWith('http') && !url.startsWith('//')) {
    const bucket = link.document_type === 'picture' ? 'machine-images' : 'product-files';
    url = `${SB}/storage/v1/object/public/${bucket}/${url}`;
  }

  if (COMMIT) {
    await client.query(
      `INSERT INTO ${S}.product_info_links (id, machine_id, display_name, url, document_type)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [link.id, rdsId, link.display_name, url, link.document_type||'other']
    );
  }
  linksInserted++;
}
console.log(`Links: inserted=${linksInserted}, skipped=${linksSkipped} (machine not in portal)`);

await client.end();
console.log(`\n${COMMIT ? '✅ Sync complete.' : '(DRY RUN) Pass --commit to apply.'}`);

// ── Helper ────────────────────────────────────────────────────────────────────
async function insertSubTables(c, rdsId, sbM, featMap, consMap, inclMap, exclMap, addonMap) {
  for (const f of (featMap.get(sbM.id)||[]))
    await c.query(`INSERT INTO ${S}.machine_features (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [rdsId, f.description, f.sort_order]);
  for (const f of (consMap.get(sbM.id)||[]))
    await c.query(`INSERT INTO ${S}.machine_consumables (machine_id,item_name,package_description,default_price,sort_order) VALUES ($1,$2,$3,$4,$5)`, [rdsId, f.item_name, f.package_description||null, f.default_price||0, f.sort_order]);
  for (const f of (inclMap.get(sbM.id)||[]))
    await c.query(`INSERT INTO ${S}.machine_inclusions (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [rdsId, f.description, f.sort_order]);
  for (const f of (exclMap.get(sbM.id)||[]))
    await c.query(`INSERT INTO ${S}.machine_exclusions (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [rdsId, f.description, f.sort_order]);
  for (const f of (addonMap.get(sbM.id)||[]))
    await c.query(`INSERT INTO ${S}.machine_addons (machine_id,description,sort_order) VALUES ($1,$2,$3)`, [rdsId, f.description, f.sort_order]);
}
