/**
 * Full comparison of checks + events between Supabase and RDS.
 * Finds: extra checks in RDS, missing checks in RDS, extra events, missing events.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const cmEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../esprint-check-monitoring/.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const H = {apikey:cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY};

async function sbAll(table, orderBy='created_at') {
  const all=[]; let off=0;
  for(;;){
    const r=await fetch(`${cmEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=id&order=${orderBy}.asc&limit=1000&offset=${off}`,{headers:H});
    const d=await r.json();
    if(!Array.isArray(d)||d.length===0)break;
    all.push(...d.map(x=>x.id));
    if(d.length<1000)break; off+=1000;
  }
  return all;
}

const sbChecks = new Set(await sbAll('checks'));
const sbEvents = new Set(await sbAll('events','recorded_at'));
console.log('Supabase — checks:', sbChecks.size, '| events:', sbEvents.size);

const c = new pg.Client({connectionString:portalEnv.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const S='check_monitoring';
const {rows:rdsC} = await c.query(`SELECT id FROM ${S}.checks`);
const {rows:rdsE} = await c.query(`SELECT id FROM ${S}.events`);
const rdsChecks = new Set(rdsC.map(r=>r.id));
const rdsEvents = new Set(rdsE.map(r=>r.id));
console.log('RDS      — checks:', rdsChecks.size, '| events:', rdsEvents.size);

const extraChecks = [...rdsChecks].filter(id=>!sbChecks.has(id));
const missingChecks = [...sbChecks].filter(id=>!rdsChecks.has(id));
const extraEvents = [...rdsEvents].filter(id=>!sbEvents.has(id));
const missingEvents = [...sbEvents].filter(id=>!rdsEvents.has(id));

console.log('\nExtra checks in RDS (delete these):', extraChecks.length);
console.log('Missing checks in RDS (add these):', missingChecks.length);
console.log('Extra events in RDS (delete these):', extraEvents.length);
console.log('Missing events in RDS (add these):', missingEvents.length);

if(extraChecks.length) console.log('  extra check IDs:', extraChecks.slice(0,10));
if(extraEvents.length) console.log('  extra event IDs:', extraEvents.slice(0,10));

await c.end();
