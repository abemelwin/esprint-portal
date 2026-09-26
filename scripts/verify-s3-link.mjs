import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const r = await c.query("SELECT display_name, url FROM sales_portal.product_info_links WHERE url LIKE '%.s3.%amazonaws.com%' LIMIT 5");
console.log('Sample S3 URLs:');
for (const l of r.rows) {
  const res = await fetch(l.url, { method: 'HEAD' });
  console.log(`  [${res.status}] ${l.display_name}`);
  console.log(`         ${l.url}`);
}
await c.end();
