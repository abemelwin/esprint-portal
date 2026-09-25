/**
 * seed-sales-catalog.mjs
 *
 * Seeds the 238 machines from the original Sales Portal into the portal's
 * RDS sales_portal schema. Merges three data sources:
 *   1. scripts/catalog-data.json  — features, inclusions, exclusions, addons, consumables
 *   2. scripts/machine-prices.json — srp, lbp, cash_price, warranty
 *   3. supabase/seed-catalog-fields.sql — has_trade_in, has_printhead, service_fee,
 *                                          availability, unit_condition (parsed from SQL)
 *
 * Safe to re-run: ON CONFLICT DO NOTHING on machines (brand+model+sub_model unique index).
 *
 * Usage: node scripts/seed-sales-catalog.mjs [--dry-run]
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN    = process.argv.includes('--dry-run');
const ORIG       = path.resolve(__dirname, '../../Sales Portal');
const PORTAL_ENV = path.resolve(__dirname, '../.env.local');

function readEnv(p) {
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

const env   = readEnv(PORTAL_ENV);
const S     = 'sales_portal';

// ── 1. Load catalog data (features, inclusions, exclusions, addons, consumables) ──
const catalogData = JSON.parse(fs.readFileSync(path.join(ORIG, 'scripts/catalog-data.json'), 'utf8'));

// ── 2. Load pricing ──
const pricesRaw = JSON.parse(fs.readFileSync(path.join(ORIG, 'scripts/machine-prices.json'), 'utf8'));
// Key by brand+model for lookup
const priceMap = new Map();
for (const p of pricesRaw) {
  const key = `${p.brand}|${p.model}`;
  priceMap.set(key, p);
}

// ── 3. Parse catalog-fields SQL for has_trade_in, has_printhead, service_fee,
//       availability, unit_condition updates (one UPDATE per machine)
const catalogFieldsSql = fs.readFileSync(path.join(ORIG, 'supabase/seed-catalog-fields.sql'), 'utf8');
const fieldMap = new Map(); // brand|model → { has_trade_in, has_printhead, service_fee, availability, unit_condition }
for (const line of catalogFieldsSql.split('\n')) {
  const m = line.match(
    /UPDATE machines SET has_trade_in=(\w+), has_printhead=(\w+), service_fee=([\d.]+), availability=NULLIF\('([^']*)',''\), image_key=NULLIF\('([^']*)',''\), unit_condition='([^']*)' WHERE brand='([^']+)' AND model='([^']+)'/
  );
  if (!m) continue;
  const [, has_trade_in, has_printhead, service_fee, availability, image_key, unit_condition, brand, model] = m;
  fieldMap.set(`${brand}|${model}`, {
    has_trade_in:  has_trade_in  === 'true',
    has_printhead: has_printhead === 'true',
    service_fee:   parseFloat(service_fee),
    availability:  availability || null,
    image_key:     image_key    || null,
    unit_condition,
  });
}

// Also parse has_laser_tube and exclude_software_concerns from the SQL
// (those are in later UPDATE-only lines — grab them separately if present)
const laserMap = new Map();
const softwareMap = new Map();
for (const line of catalogFieldsSql.split('\n')) {
  const laserM = line.match(/UPDATE machines SET has_laser_tube=(\w+) WHERE brand='([^']+)' AND model='([^']+)'/);
  if (laserM) laserMap.set(`${laserM[2]}|${laserM[3]}`, laserM[1] === 'true');
  const softM  = line.match(/UPDATE machines SET exclude_software_concerns=(\w+) WHERE brand='([^']+)' AND model='([^']+)'/);
  if (softM)  softwareMap.set(`${softM[2]}|${softM[3]}`, softM[1] === 'true');
}

// ── 4. Connect and insert ──
const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
if (!DRY_RUN) await client.connect();

let inserted = 0, skipped = 0, errors = 0;

for (const m of catalogData) {
  const key     = `${m.brand}|${m.model}`;
  const prices  = priceMap.get(key) ?? {};
  const fields  = fieldMap.get(key) ?? {};
  const laser   = laserMap.get(key) ?? false;
  const excSoft = softwareMap.has(key) ? softwareMap.get(key) : true;

  if (DRY_RUN) {
    console.log('DRY RUN:', m.brand, '|', m.model.slice(0, 60), '| price?', !!prices.srp);
    inserted++;
    continue;
  }

  try {
    // Insert machine — ON CONFLICT DO NOTHING (idempotent)
    const rows = await client.query(
      `INSERT INTO ${S}.machines
         (brand, model, sub_model, unit_condition, letterhead,
          srp, lbp, cash_price, machine_warranty_months, printhead_warranty,
          has_trade_in, has_printhead, has_laser_tube, exclude_software_concerns,
          service_fee, availability, image_key, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true)
       ON CONFLICT (brand, model, COALESCE(sub_model,'')) DO NOTHING
       RETURNING id`,
      [
        m.brand,
        m.model,
        m.sub_model || null,
        fields.unit_condition || m.unit_condition || 'Brand New',
        m.letterhead || 'ES Print Media Inc.',
        prices.srp         ?? 0,
        prices.lbp         ?? 0,
        prices.cashPrice   ?? 0,
        prices.machineWarranty    ?? 12,
        String(prices.printheadWarranty ?? '0 mo.'),
        fields.has_trade_in  ?? false,
        fields.has_printhead ?? false,
        laser,
        excSoft,
        fields.service_fee   ?? 0,
        fields.availability  ?? null,
        fields.image_key     ?? null,
      ]
    );

    if (rows.rowCount === 0) {
      skipped++;
      continue; // already exists
    }

    const machineId = rows.rows[0].id;
    inserted++;

    // Sub-tables (skip if empty arrays)
    const subs = [
      { table: 'machine_features',   arr: m.features   || [], cols: ['description','sort_order'], row: (v,i) => [v,i] },
      { table: 'machine_inclusions', arr: m.inclusions  || [], cols: ['description','sort_order'], row: (v,i) => [v,i] },
      { table: 'machine_exclusions', arr: m.exclusions  || [], cols: ['description','sort_order'], row: (v,i) => [v,i] },
      { table: 'machine_addons',     arr: m.addons      || [], cols: ['description','sort_order'], row: (v,i) => [v,i] },
    ];

    for (const { table, arr, cols, row } of subs) {
      for (let i = 0; i < arr.length; i++) {
        await client.query(
          `INSERT INTO ${S}.${table} (machine_id, ${cols.join(',')}) VALUES ($1,$2,$3)`,
          [machineId, ...row(arr[i], i)]
        );
      }
    }

    // Consumables (different shape: {item_name, package_description, default_price})
    for (let i = 0; i < (m.consumables || []).length; i++) {
      const c = m.consumables[i];
      await client.query(
        `INSERT INTO ${S}.machine_consumables (machine_id, item_name, package_description, default_price, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [machineId, c.item_name, c.package_description || null, c.default_price || 0, i]
      );
    }

  } catch (err) {
    console.error(`ERROR inserting ${m.brand} | ${m.model}:`, err.message);
    errors++;
  }
}

if (!DRY_RUN) await client.end();

console.log(`\n${DRY_RUN ? '(DRY RUN) ' : ''}✅ Done — inserted: ${inserted}, skipped (already existed): ${skipped}, errors: ${errors}`);
