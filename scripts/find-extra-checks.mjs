import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const cmEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../esprint-check-monitoring/.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));

const H = {apikey:cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY};

// Get all Supabase check IDs
const all = [];
let offset = 0;
for(;;){
  const r = await fetch(`${cmEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/checks?select=id&limit=1000&offset=${offset}`,{headers:H});
  const d = await r.json();
  if(!Array.isArray(d)||d.length===0) break;
  all.push(...d.map(x=>x.id));
  if(d.length<1000) break;
  offset+=1000;
}
console.log('Supabase IDs:', all.length);

// Compare with RDS
const c = new pg.Client({connectionString:portalEnv.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const {rows} = await c.query('SELECT id,check_no,bank,client_code,created_at FROM check_monitoring.checks ORDER BY created_at DESC');
const sbSet = new Set(all);
const extra = rows.filter(r=>!sbSet.has(r.id));
console.log('\nExtra checks in RDS (not in Supabase):');
extra.forEach(x=>console.log(' ',x.client_code, x.bank, x.check_no, String(x.created_at).slice(0,10)));
await c.end();
