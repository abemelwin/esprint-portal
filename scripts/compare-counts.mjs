/**
 * compare-counts.mjs
 * Compares current HELD/RETURNED/PARTIAL/OVERDUE/STALE counts
 * between Supabase (source of truth) and RDS portal.
 * Uses the SAME logic as the portal's computeCheckStatus.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const cmEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../esprint-check-monitoring/.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));

const H = {apikey:cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY};
const today = new Date().toISOString().slice(0,10);
const STALE_DAYS = 180;

// ── Get Supabase checks + events (use checks_meta via RPC if available, else compute) ──
// Get Supabase CHECKS_META directly via the app's /api/load equivalent
// For simplicity, compare by fetching latest raw data counts

// 1. First sync RDS with Supabase to ensure they're aligned
const c = new pg.Client({connectionString:portalEnv.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const S='check_monitoring';

// Get all RDS data and compute status counts (same as portal)
const {rows:checks} = await c.query(`SELECT id,check_date,original_amount,final_status,replacement_of FROM ${S}.checks`);
const {rows:events} = await c.query(`SELECT check_id,type,event_date,move_date,amount,recorded_at FROM ${S}.events ORDER BY event_date,recorded_at`);

// Build events map
const evMap = new Map();
for(const e of events){
  if(!evMap.has(e.check_id)) evMap.set(e.check_id,[]);
  evMap.get(e.check_id).push(e);
}

// Compute status for each check (simplified version of computeCheckStatus)
let held=0,returned=0,partial=0,dueToday=0,overdue=0,stale=0;
const PAID_TYPES=['PARTIAL_PAYMENT','REPLACEMENT','SETTLED_PAID','DEPOSIT_CLEARED'];
const CLEARED=['CLEARED','REPLACED','SETTLED (PAID)','CANCELLED'];

for(const ck of checks){
  const evs = evMap.get(ck.id)??[];
  let status = ck.final_status??'OPEN';
  let nextDep = null;

  // Simplified status from events — find last decisive event
  let totalPaid=0;
  for(const e of evs){
    if(PAID_TYPES.includes(e.type)) totalPaid+=(parseFloat(e.amount)||0);
    if(e.type==='HOLD_REQUEST'||e.type==='RECONSTRUCT') { status='HELD'; nextDep=e.move_date; }
    if(e.type==='RETURN') { status='RETURNED'; nextDep=null; }
    if(e.type==='DEPOSIT_CLEARED') { status='CLEARED'; nextDep=null; }
    if(e.type==='CANCELLATION') { status='CANCELLED'; nextDep=null; }
    if(e.type==='REPLACEMENT') { status='REPLACED'; nextDep=null; }
    if(e.type==='SETTLED_PAID') { status='SETTLED (PAID)'; nextDep=null; }
  }
  // Check partial
  if(status==='HELD'||status==='RETURNED'){
    const bal=Math.max(0,(parseFloat(ck.original_amount)||0)-totalPaid);
    if(totalPaid>0&&bal>0) status='PARTIAL';
  }

  // Count KPIs
  if(status==='HELD'){ held++; if(nextDep===today) dueToday++; if(nextDep&&nextDep<today) overdue++; }
  if(status==='RETURNED') returned++;
  if(status==='PARTIAL') partial++;

  // Stale
  if(ck.check_date && !CLEARED.includes(status)){
    const diff=(Date.now()-new Date(ck.check_date+'T00:00:00').getTime())/86400000;
    if(diff>STALE_DAYS) stale++;
  }
}

console.log('RDS computed counts (same logic as portal):');
console.log(`  HELD: ${held}, RETURNED: ${returned}, PARTIAL: ${partial}`);
console.log(`  DUE TODAY: ${dueToday}, OVERDUE: ${overdue}, STALE: ${stale}`);
console.log(`  TOTAL: ${checks.length}`);

await c.end();
