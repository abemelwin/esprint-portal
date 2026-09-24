/**
 * reconcile.mjs — full two-way alignment of RDS to match Supabase exactly.
 *
 *   - Adds missing checks / events / notes / schedule
 *   - Deletes extra checks / events (removed from Supabase)
 *   - Resolves recorded_by / created_by UUIDs to names
 *
 * DRY RUN by default. Pass --commit to apply.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = process.argv.includes('--commit');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const cmEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../esprint-check-monitoring/.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const H = {apikey:cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY};
const SB = cmEnv.NEXT_PUBLIC_SUPABASE_URL;

async function sbAll(table, orderBy='created_at') {
  const all=[]; let off=0;
  for(;;){
    const r=await fetch(`${SB}/rest/v1/${table}?select=*&order=${orderBy}.asc&limit=1000&offset=${off}`,{headers:H});
    const d=await r.json();
    if(!Array.isArray(d)||d.length===0)break;
    all.push(...d);
    if(d.length<1000)break; off+=1000;
  }
  return all;
}

async function userMap() {
  const map=new Map(); let page=1;
  for(;;){
    const r=await fetch(`${SB}/auth/v1/admin/users?per_page=1000&page=${page}`,{headers:H});
    const d=await r.json(); const u=d.users??[];
    for(const x of u){const m=x.user_metadata??{};map.set(x.id,m.full_name??m.name??x.email??x.id);}
    if(u.length<1000)break; page++;
  }
  return map;
}

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const c = new pg.Client({connectionString:portalEnv.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const S='check_monitoring';

// ── CLIENTS ──
const sbClients = await sbAll('clients');
const {rows:rc} = await c.query(`SELECT code FROM ${S}.clients`);
const rcSet = new Set(rc.map(r=>r.code));
const newClients = sbClients.filter(x=>!rcSet.has(x.code));
console.log('Clients — new:', newClients.length);
if(COMMIT) for(const x of newClients){
  await c.query(`INSERT INTO ${S}.clients (code,name,branch_id,ae) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,[x.code,x.name,x.branch_id??null,x.ae??null]);
}

// ── CHECKS ──
const sbChecks = await sbAll('checks');
const sbCheckIds = new Set(sbChecks.map(x=>x.id));
const {rows:rcheck} = await c.query(`SELECT id FROM ${S}.checks`);
const rCheckSet = new Set(rcheck.map(r=>r.id));
const newChecks = sbChecks.filter(x=>!rCheckSet.has(x.id));
const extraChecks = [...rCheckSet].filter(id=>!sbCheckIds.has(id));
console.log('Checks — new:', newChecks.length, '| extra (delete):', extraChecks.length);
if(COMMIT){
  for(const x of newChecks){
    await c.query(`INSERT INTO ${S}.checks (id,client_code,branch_id,subsidiary,ae,bank,check_no,check_date,original_amount,payment_for,payment_description,notes,final_status,blacklist_reason,replacement_of,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (id) DO NOTHING`,
      [x.id,x.client_code,x.branch_id,x.subsidiary??null,x.ae??null,x.bank??null,x.check_no,x.check_date??null,x.original_amount,x.payment_for??null,x.payment_description??'',x.notes??'',x.final_status??null,x.blacklist_reason??null,x.replacement_of??null,x.created_by??null,x.created_at]);
  }
  for(const id of extraChecks){
    await c.query(`DELETE FROM ${S}.events WHERE check_id=$1`,[id]);
    await c.query(`DELETE FROM ${S}.check_notes WHERE check_id=$1`,[id]);
    await c.query(`DELETE FROM ${S}.checks WHERE id=$1`,[id]);
  }
}

// ── EVENTS ──
const sbEvents = await sbAll('events','recorded_at');
const sbEventIds = new Set(sbEvents.map(x=>x.id));
const {rows:revent} = await c.query(`SELECT id FROM ${S}.events`);
const rEventSet = new Set(revent.map(r=>r.id));
const newEvents = sbEvents.filter(x=>!rEventSet.has(x.id));
const extraEvents = [...rEventSet].filter(id=>!sbEventIds.has(id));
console.log('Events — new:', newEvents.length, '| extra (delete):', extraEvents.length);
if(COMMIT){
  for(const x of newEvents){
    // Only insert if the parent check exists
    await c.query(`INSERT INTO ${S}.events (id,check_id,type,event_date,move_date,reason,method,reference,amount,notes,recorded_by,recorded_at) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12 WHERE EXISTS (SELECT 1 FROM ${S}.checks WHERE id=$2) ON CONFLICT (id) DO NOTHING`,
      [x.id,x.check_id,x.type,x.event_date??null,x.move_date??null,x.reason??null,x.method??null,x.reference??null,x.amount??null,x.notes??'',x.recorded_by??null,x.recorded_at]);
  }
  for(const id of extraEvents){
    await c.query(`DELETE FROM ${S}.events WHERE id=$1`,[id]);
  }
}

// ── NOTES ──
const sbNotes = await sbAll('check_notes','created_at');
const sbNoteIds = new Set(sbNotes.map(x=>x.id));
const {rows:rnote} = await c.query(`SELECT id FROM ${S}.check_notes`);
const rNoteSet = new Set(rnote.map(r=>r.id));
const newNotes = sbNotes.filter(x=>!rNoteSet.has(x.id));
const extraNotes = [...rNoteSet].filter(id=>!sbNoteIds.has(id));
console.log('Notes — new:', newNotes.length, '| extra (delete):', extraNotes.length);
if(COMMIT){
  for(const x of newNotes){
    await c.query(`INSERT INTO ${S}.check_notes (id,check_id,content,created_by,created_by_name,created_at) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS (SELECT 1 FROM ${S}.checks WHERE id=$2) ON CONFLICT (id) DO NOTHING`,
      [x.id,x.check_id,x.content,x.created_by??'',x.created_by_name??'',x.created_at]);
  }
  for(const id of extraNotes){
    await c.query(`DELETE FROM ${S}.check_notes WHERE id=$1`,[id]);
  }
}

// ── Resolve UUID names ──
if(COMMIT){
  const um = await userMap();
  let resolved=0;
  for(const [t,col] of [[`${S}.events`,'recorded_by'],[`${S}.checks`,'created_by'],[`${S}.check_notes`,'created_by']]){
    const {rows}=await c.query(`SELECT id, ${col} AS v FROM ${t} WHERE ${col} IS NOT NULL`);
    for(const r of rows){
      if(!UUID_RE.test(r.v))continue;
      const name=um.get(r.v); if(!name)continue;
      await c.query(`UPDATE ${t} SET ${col}=$1 WHERE id=$2`,[name,r.id]); resolved++;
    }
  }
  console.log('Names resolved:', resolved);
}

// Final counts
const {rows:fc}=await c.query(`SELECT count(*) FROM ${S}.checks`);
const {rows:fe}=await c.query(`SELECT count(*) FROM ${S}.events`);
console.log(`\nFinal RDS — checks: ${fc[0].count}, events: ${fe[0].count}`);
console.log(COMMIT?'✅ Reconciled.':'(DRY RUN — pass --commit to apply)');
await c.end();
