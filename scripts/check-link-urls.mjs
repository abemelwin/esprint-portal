import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../Sales Portal/.env'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const SB=spEnv.VITE_SUPABASE_URL, KEY=spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const H={apikey:KEY,Authorization:`Bearer ${KEY}`};

// Get raw links — show the EXACT url column value
const r = await fetch(`${SB}/rest/v1/product_info_links?select=id,display_name,url,document_type&limit=15`, { headers: H });
const links = await r.json();
console.log('Raw url column values from Supabase:');
links.forEach(l => console.log(`  [${l.document_type}] "${l.url}"`));

// Count how many are storage paths vs external
const all = await fetch(`${SB}/rest/v1/product_info_links?select=url&limit=2000`, { headers: H });
const allLinks = await all.json();
const http = allLinks.filter(l => l.url?.startsWith('http'));
const storage = allLinks.filter(l => l.url && !l.url.startsWith('http'));
console.log(`\nTotal: ${allLinks.length}`);
console.log(`External URLs (http): ${http.length}`);
console.log(`Storage paths: ${storage.length}`);
console.log('\nSample storage paths:');
storage.slice(0,10).forEach(l => console.log(`  "${l.url}"`));
