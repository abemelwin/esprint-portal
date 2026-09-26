import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../Sales Portal/.env'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const SB=spEnv.VITE_SUPABASE_URL, KEY=spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const H={apikey:KEY,Authorization:`Bearer ${KEY}`};

async function listFolder(prefix) {
  const r = await fetch(`${SB}/storage/v1/object/list/product-files`, {
    method:'POST', headers:{...H,'Content-Type':'application/json'},
    body: JSON.stringify({ limit:1000, prefix, sortBy:{column:'name',order:'asc'} })
  });
  return await r.json();
}

// Inspect first folder deeply
const top = await listFolder('');
const first = top[0];
console.log('First top entry:', JSON.stringify(first, null, 2));
console.log('\nListing inside first folder:', first.name + '/');
const inside = await listFolder(first.name + '/');
console.log(JSON.stringify(inside, null, 2).slice(0, 1500));

// Check what product_info_links actual URLs look like (already migrated)
console.log('\n─── Sample product_info_links from Supabase ───');
const r = await fetch(`${SB}/rest/v1/product_info_links?select=display_name,url,document_type&limit=8`, { headers: H });
const links = await r.json();
links.forEach(l => console.log(`  [${l.document_type}] ${l.display_name}: ${l.url?.slice(0,80)}`));
