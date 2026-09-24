import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const cmEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../esprint-check-monitoring/.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));

const c = new pg.Client({connectionString:portalEnv.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const S='check_monitoring';

// Check RDS recon_schedule
try {
  const r = await c.query(`SELECT count(*) FROM ${S}.recon_schedule`);
  console.log('RDS recon_schedule total rows:', r.rows[0].count);
  const r2 = await c.query(`SELECT client_code, count(*) FROM ${S}.recon_schedule GROUP BY client_code LIMIT 20`);
  console.log('By client:');
  r2.rows.forEach(x=>console.log('  ', x.client_code, x.count));
} catch(e){ console.log('RDS recon_schedule error:', e.message); }

await c.end();

// Check Supabase for schedule
const H = {apikey:cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY};
// Try common table names
for (const t of ['recon_schedule','reconstruct_schedule','payment_schedule','recon_payment_schedule']) {
  const r = await fetch(cmEnv.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/'+t+'?select=*&limit=1',{headers:{...H,Prefer:'count=exact',Range:'0-0'}});
  const cr = r.headers.get('content-range');
  console.log('Supabase '+t+':', r.status, cr??'');
}
