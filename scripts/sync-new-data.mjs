/**
 * sync-new-data.mjs
 *
 * Syncs new rows from Supabase → RDS for checks, events, and check_notes.
 * Only inserts rows whose IDs are NOT already in RDS (safe to run multiple times).
 *
 * Usage:
 *   node scripts/sync-new-data.mjs           # dry run (shows what will be inserted)
 *   node scripts/sync-new-data.mjs --commit  # apply
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = process.argv.includes('--commit');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readEnv(p) {
  return Object.fromEntries(
    fs.readFileSync(p,'utf8').split('\n')
      .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
      .map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]})
  );
}

const portalEnv = readEnv(path.resolve(__dirname,'..', '.env.local'));
const cmEnv     = readEnv(path.resolve(__dirname,'..','..','esprint-check-monitoring','.env.local'));

const SB_URL = cmEnv.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = cmEnv.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SB_KEY, Authorization: 'Bearer '+SB_KEY };

const rds = new pg.Client({ connectionString: portalEnv.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await rds.connect();
const S = 'check_monitoring';

async function sbGetAll(table, select='*', orderBy='created_at') {
  const all = [];
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const r = await fetch(
      `${SB_URL}/rest/v1/${table}?select=${select}&order=${orderBy}.asc&limit=${PAGE}&offset=${offset}`,
      { headers: H }
    );
    const batch = await r.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── 1. Sync clients (must run before checks due to FK) ───────────────────────
console.log('\n[0/3] Clients…');
const sbClients = await sbGetAll('clients');
const { rows: rdsClientCodes } = await rds.query(`SELECT code FROM ${S}.clients`);
const existingClientCodes = new Set(rdsClientCodes.map(r=>r.code));
const newClients = sbClients.filter(c => !existingClientCodes.has(c.code));
console.log(`  Supabase: ${sbClients.length}, RDS: ${existingClientCodes.size}, New: ${newClients.length}`);

if (COMMIT && newClients.length > 0) {
  for (const c of newClients) {
    await rds.query(
      `INSERT INTO ${S}.clients (code, name, branch_id, ae)
       VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
      [c.code, c.name, c.branch_id ?? null, c.ae ?? null]
    );
  }
  console.log(`  ✅ Inserted ${newClients.length} new clients`);
}

// ── 2. Sync checks ────────────────────────────────────────────────────────────
console.log('\n[1/3] Checks…');
const sbChecks = await sbGetAll('checks');
const { rows: rdsCheckIds } = await rds.query(`SELECT id FROM ${S}.checks`);
const existingCheckIds = new Set(rdsCheckIds.map(r=>r.id));
const newChecks = sbChecks.filter(c => !existingCheckIds.has(c.id));
console.log(`  Supabase: ${sbChecks.length}, RDS: ${existingCheckIds.size}, New: ${newChecks.length}`);

if (COMMIT && newChecks.length > 0) {
  for (const c of newChecks) {
    await rds.query(
      `INSERT INTO ${S}.checks
        (id,client_code,branch_id,subsidiary,ae,bank,check_no,check_date,
         original_amount,payment_for,payment_description,notes,final_status,
         blacklist_reason,replacement_of,created_by,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.client_code, c.branch_id, c.subsidiary??null, c.ae??null,
       c.bank??null, c.check_no, c.check_date??null, c.original_amount,
       c.payment_for??null, c.payment_description??'', c.notes??'',
       c.final_status??null, c.blacklist_reason??null, c.replacement_of??null,
       c.created_by??null, c.created_at]
    );
  }
  console.log(`  ✅ Inserted ${newChecks.length} new checks`);
}

// ── 2. Sync events ────────────────────────────────────────────────────────────
console.log('\n[2/3] Events…');
const sbEvents = await sbGetAll('events', '*', 'recorded_at');
const { rows: rdsEventIds } = await rds.query(`SELECT id FROM ${S}.events`);
const existingEventIds = new Set(rdsEventIds.map(r=>r.id));
const newEvents = sbEvents.filter(e => !existingEventIds.has(e.id));
console.log(`  Supabase: ${sbEvents.length}, RDS: ${existingEventIds.size}, New: ${newEvents.length}`);

if (COMMIT && newEvents.length > 0) {
  for (const e of newEvents) {
    await rds.query(
      `INSERT INTO ${S}.events
        (id,check_id,type,event_date,move_date,reason,method,reference,
         amount,notes,recorded_by,recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [e.id, e.check_id, e.type, e.event_date??null, e.move_date??null,
       e.reason??null, e.method??null, e.reference??null,
       e.amount??null, e.notes??'', e.recorded_by??null, e.recorded_at]
    );
  }
  console.log(`  ✅ Inserted ${newEvents.length} new events`);
}

// ── 3. Sync check_notes ───────────────────────────────────────────────────────
console.log('\n[3/3] Check notes…');
const sbNotes = await sbGetAll('check_notes', '*', 'created_at');
const { rows: rdsNoteIds } = await rds.query(`SELECT id FROM ${S}.check_notes`);
const existingNoteIds = new Set(rdsNoteIds.map(r=>r.id));
const newNotes = sbNotes.filter(n => !existingNoteIds.has(n.id));
console.log(`  Supabase: ${sbNotes.length}, RDS: ${existingNoteIds.size}, New: ${newNotes.length}`);

if (COMMIT && newNotes.length > 0) {
  for (const n of newNotes) {
    await rds.query(
      `INSERT INTO ${S}.check_notes
        (id,check_id,content,created_by,created_by_name,created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [n.id, n.check_id, n.content, n.created_by??'', n.created_by_name??'', n.created_at]
    );
  }
  console.log(`  ✅ Inserted ${newNotes.length} new notes`);
}

await rds.end();
console.log(COMMIT ? '\n✅ Sync complete.' : '\n(DRY RUN — pass --commit to apply)');
