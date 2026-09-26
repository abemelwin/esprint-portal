import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const spEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../Sales Portal/.env'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const H={apikey:spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY}`};
const c = new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const r = await c.query("SELECT id, display_name, url FROM sales_portal.product_info_links WHERE url LIKE '%supabase.co/storage%'");
console.log(`${r.rows.length} links still on Supabase:\n`);
for (const l of r.rows) {
  // Test if the file is reachable
  const res = await fetch(l.url, { method: 'HEAD', headers: H });
  console.log(`  [${res.status}] ${l.display_name}`);
  console.log(`         ${l.url.slice(0, 120)}`);
}
await c.end();
