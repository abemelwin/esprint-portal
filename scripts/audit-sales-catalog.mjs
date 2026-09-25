/**
 * audit-sales-catalog.mjs
 * Full audit: compares every machine + sub-table between Supabase and RDS.
 * Shows exactly what differs.
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
const SB = spEnv.VITE_SUPABASE_URL;
const H  = { apikey: spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY}` };

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

const client = new pg.Client({ connectionString: portalEnv.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const S = 'sales_portal';

// Fetch everything
const [sbMachines, rdsMachinesRes,
       sbFeatures, sbConsumables, sbInclusions, sbExclusions, sbAddons,
       rdsFeatures, rdsConsumables, rdsInclusions, rdsExclusions, rdsAddons] = await Promise.all([
  sbAll('machines'),
  client.query(`SELECT * FROM ${S}.machines`),
  sbAll('machine_features',   'machine_id,description,sort_order','sort_order'),
  sbAll('machine_consumables','machine_id,item_name,package_description,default_price,sort_order','sort_order'),
  sbAll('machine_inclusions', 'machine_id,description,sort_order','sort_order'),
  sbAll('machine_exclusions', 'machine_id,description,sort_order','sort_order'),
  sbAll('machine_addons',     'machine_id,description,sort_order','sort_order'),
  client.query(`SELECT machine_id,description,sort_order FROM ${S}.machine_features ORDER BY sort_order`),
  client.query(`SELECT machine_id,item_name,package_description,default_price,sort_order FROM ${S}.machine_consumables ORDER BY sort_order`),
  client.query(`SELECT machine_id,description,sort_order FROM ${S}.machine_inclusions ORDER BY sort_order`),
  client.query(`SELECT machine_id,description,sort_order FROM ${S}.machine_exclusions ORDER BY sort_order`),
  client.query(`SELECT machine_id,description,sort_order FROM ${S}.machine_addons ORDER BY sort_order`),
]);

const sbActive = sbMachines.filter(m => m.is_active !== false);
const rdsRows  = rdsMachinesRes.rows;

// Build key maps
const sbKeyMap  = new Map(sbActive.map(m => [`${m.brand}|${m.model}|${m.sub_model||''}`, m]));
const rdsKeyMap = new Map(rdsRows.map(m => [`${m.brand}|${m.model}|${(m.sub_model)||''}`, m]));

// Machines only in portal (not in orig)
const onlyPortal = rdsRows.filter(m => !sbKeyMap.has(`${m.brand}|${m.model}|${(m.sub_model)||''}`));

console.log('=== CATALOG AUDIT ===');
console.log(`Supabase active : ${sbActive.length}`);
console.log(`Portal RDS      : ${rdsRows.length}`);
console.log(`Only in portal  : ${onlyPortal.length}`);
if(onlyPortal.length){
  console.log('\nMachines in PORTAL but NOT in Supabase (may need review):');
  onlyPortal.forEach(m => console.log(`  ${m.brand} | ${m.model}`));
}

// Build SB machine_id → RDS id map
const sbToRds = new Map();
for(const sbM of sbActive){
  const rdsM = rdsKeyMap.get(`${sbM.brand}|${sbM.model}|${sbM.sub_model||''}`);
  if(rdsM) sbToRds.set(sbM.id, rdsM.id);
}

// Check sub-table sync for each matched machine
function buildSubMap(arr, idField='machine_id'){
  const m=new Map();
  for(const r of arr){ if(!m.has(r[idField])) m.set(r[idField],[]); m.get(r[idField]).push(r); }
  return m;
}
const sbFeatMap=buildSubMap(sbFeatures);
const sbConsMap=buildSubMap(sbConsumables);
const sbInclMap=buildSubMap(sbInclusions);
const sbExclMap=buildSubMap(sbExclusions);
const sbAddonMap=buildSubMap(sbAddons);
const rdsFeatMap=buildSubMap(rdsFeatures.rows);
const rdsConsMap=buildSubMap(rdsConsumables.rows);
const rdsInclMap=buildSubMap(rdsInclusions.rows);
const rdsExclMap=buildSubMap(rdsExclusions.rows);
const rdsAddonMap=buildSubMap(rdsAddons.rows);

let subTableDiff = 0;
for(const sbM of sbActive){
  const rdsId = sbToRds.get(sbM.id);
  if(!rdsId) continue;
  const checks = [
    ['features',    sbFeatMap.get(sbM.id)||[],    rdsFeatMap.get(rdsId)||[],    r=>r.description],
    ['consumables', sbConsMap.get(sbM.id)||[],    rdsConsMap.get(rdsId)||[],    r=>r.item_name],
    ['inclusions',  sbInclMap.get(sbM.id)||[],    rdsInclMap.get(rdsId)||[],    r=>r.description],
    ['exclusions',  sbExclMap.get(sbM.id)||[],    rdsExclMap.get(rdsId)||[],    r=>r.description],
    ['addons',      sbAddonMap.get(sbM.id)||[],   rdsAddonMap.get(rdsId)||[],   r=>r.description],
  ];
  for(const [name, sbArr, rdsArr, key] of checks){
    if(sbArr.length !== rdsArr.length){
      subTableDiff++;
      if(subTableDiff<=20) console.log(`  DIFF ${name}: ${sbM.brand}|${sbM.model} → SB=${sbArr.length} RDS=${rdsArr.length}`);
    }
  }
}
console.log(`\nSub-table count mismatches: ${subTableDiff}`);
console.log('\nAudit complete.');
await client.end();
