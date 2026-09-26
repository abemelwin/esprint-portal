import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();

// Broken links: still on supabase storage AND (contain file:/// OR %0D%0A newline OR are the known-broken ones)
const r = await c.query(`
  SELECT id, display_name, url FROM sales_portal.product_info_links
  WHERE url LIKE '%supabase.co/storage%'
    AND (url LIKE '%file:///%' OR url LIKE '%\\%0D\\%0A%' OR url LIKE '%F9530H%2%')
`);
console.log(`Broken links to remove: ${r.rows.length}`);
r.rows.forEach(l => console.log(`  ${l.display_name}`));

if (COMMIT) {
  for (const l of r.rows) {
    await c.query('DELETE FROM sales_portal.product_info_links WHERE id=$1', [l.id]);
  }
  console.log(`\n✅ Deleted ${r.rows.length} broken links.`);
} else {
  console.log('\n(DRY RUN) Pass --commit to delete.');
}
await c.end();
