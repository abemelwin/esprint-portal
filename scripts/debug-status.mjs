/**
 * debug-status.mjs
 * Runs the EXACT same computeCheckStatus logic as the portal
 * and compares with Supabase CHECKS_META counts.
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

// Get Supabase CHECKS_META (the app pre-computes this)
// We'll get checks_meta via the checks table + events using same logic
// First get SB current event counts by type for checks that show RETURNED
const sbR = await fetch(
  `${cmEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/checks?select=id,final_status&final_status=eq.RECON+REPLACED&limit=5`,
  {headers:H}
);
const reconReplaced = await sbR.json();
console.log('Sample RECON REPLACED checks:', reconReplaced.length);

// Get events of type RETURN grouped by check to understand RETURNED count difference
// In the orig app, RETURNED = checks where last event type is RETURN and no subsequent HOLD_REQUEST
// Let's look at how many checks have RETURN as last event in both systems
const c = new pg.Client({connectionString:portalEnv.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const S='check_monitoring';

// Checks with RETURN as latest event but also have a later HOLD_REQUEST
const {rows: returnThenHold} = await c.query(`
  WITH last_events AS (
    SELECT DISTINCT ON (check_id) check_id, type, event_date, recorded_at
    FROM ${S}.events
    ORDER BY check_id, event_date DESC, recorded_at DESC
  )
  SELECT count(*) FROM last_events WHERE type = 'RETURN'
`);
console.log('\nChecks where LAST event is RETURN:', returnThenHold[0].count);

const {rows: lastHold} = await c.query(`
  WITH last_events AS (
    SELECT DISTINCT ON (check_id) check_id, type, event_date, recorded_at
    FROM ${S}.events
    ORDER BY check_id, event_date DESC, recorded_at DESC
  )
  SELECT count(*) FROM last_events WHERE type = 'HOLD_REQUEST'
`);
console.log('Checks where LAST event is HOLD_REQUEST:', lastHold[0].count);

// Checks with finalStatus RECON REPLACED + last event being RETURN
const {rows: reconReplacedReturn} = await c.query(`
  WITH last_events AS (
    SELECT DISTINCT ON (check_id) check_id, type
    FROM ${S}.events
    ORDER BY check_id, event_date DESC, recorded_at DESC
  )
  SELECT count(*) FROM ${S}.checks ch
  JOIN last_events le ON le.check_id = ch.id
  WHERE ch.final_status = 'RECON REPLACED' AND le.type = 'RETURN'
`);
console.log('\nRECON REPLACED checks where last event is RETURN:', reconReplacedReturn[0].count);
console.log('(These should be RETURNED in portal but may be RECON REPLACED in orig)');

// Get final_status distribution
const {rows: finalStatus} = await c.query(`
  SELECT final_status, count(*) 
  FROM ${S}.checks 
  WHERE final_status IS NOT NULL 
  GROUP BY final_status 
  ORDER BY count DESC
`);
console.log('\nfinal_status distribution:');
finalStatus.forEach(x=>console.log('  ', (x.final_status||'NULL').padEnd(25), x.count));

await c.end();
