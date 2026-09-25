import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const S = 'sales_portal';
const tables = ['machines','machine_features','machine_consumables','machine_inclusions','machine_exclusions','machine_addons','product_info_links','quotes'];
for (const t of tables) {
  const r = await c.query(`SELECT count(*) FROM ${S}.${t}`);
  console.log(`  ${t}: ${r.rows[0].count}`);
}
// Sample: check a machine has all fields
const r = await c.query(`SELECT brand, model, srp, has_trade_in, has_printhead, service_fee, availability FROM ${S}.machines LIMIT 3`);
console.log('\nSample machines:');
r.rows.forEach(x => console.log(`  ${x.brand} | ${x.model.slice(0,40)} | srp=${x.srp} | trade=${x.has_trade_in} | ph=${x.has_printhead} | fee=${x.service_fee} | avail=${x.availability?.slice(0,20) ?? 'null'}`));
// Brands count
const b = await c.query(`SELECT brand, count(*) FROM ${S}.machines GROUP BY brand ORDER BY brand`);
console.log('\nBrands:', b.rows.map(r=>`${r.brand}(${r.count})`).join(', '));
await c.end();
