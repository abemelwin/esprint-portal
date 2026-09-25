/**
 * compare-status.mjs
 * Runs the EXACT current portal computeCheckStatus logic against BOTH
 * the RDS (portal) data and Supabase (orig) data, and compares the
 * HELD / RETURNED / PARTIAL / status distribution counts.
 *
 * Also prints, per status, which check IDs differ between the two sources
 * (should be empty once data is reconciled + logic matches).
 *
 * READ-ONLY. No writes anywhere.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readEnv = (p) => Object.fromEntries(
  fs.readFileSync(p, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const portalEnv = readEnv(path.resolve(__dirname, '../.env.local'));
const cmEnv = readEnv(path.resolve(__dirname, '../../esprint-check-monitoring/.env.local'));
const SB = cmEnv.NEXT_PUBLIC_SUPABASE_URL;
const H = { apikey: cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + cmEnv.SUPABASE_SERVICE_ROLE_KEY };

// Normalize any date-ish value to 'YYYY-MM-DD' string (RDS pg returns Date objects)
function dstr(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function tstr(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// ── event comparator WITH deterministic tie-breaker ──
// When eventDate AND recordedAt are equal, order is otherwise undefined and
// depends on DB row order (differs RDS vs Supabase). Tie-break so a RETURN is
// treated as the LATER event vs a same-instant PARTIAL_PAYMENT -> RETURNED wins,
// matching the orig's observed result.
const TYPE_ORDER = { RETURN: 0, PARTIAL_PAYMENT: 1 };
function compareEvents(a, b) {
  const dateCmp = (a.eventDate ?? '').localeCompare(b.eventDate ?? '');
  if (dateCmp !== 0) return dateCmp;
  const recCmp = (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '');
  if (recCmp !== 0) return recCmp;
  const ao = TYPE_ORDER[a.type] ?? 0, bo = TYPE_ORDER[b.type] ?? 0;
  return ao - bo;
}

// ── EXACT current portal computeCheckStatus (mirrored) ──
function computeCheckStatus(check, sortedEvents) {
  let status = check.finalStatus || 'OPEN';
  let holdCount = 0, returnCount = 0, totalPaid = 0;
  for (const ev of sortedEvents) {
    if (ev.type === 'HOLD_REQUEST') holdCount++;
    if (ev.type === 'RETURN') returnCount++;
    if (ev.type === 'PARTIAL_PAYMENT' || ev.type === 'REPLACEMENT' || ev.type === 'SETTLED_PAID') totalPaid += ev.amount ?? 0;
  }
  // Narrow override (matches orig): only these 3 event types override a finalStatus
  if (check.finalStatus && sortedEvents.length > 0) {
    const lastEv = sortedEvents[sortedEvents.length - 1];
    if (lastEv.type === 'SETTLED_PAID') status = 'SETTLED (PAID)';
    else if (lastEv.type === 'PARTIAL_PAYMENT') status = (check.originalAmount - totalPaid) <= 0.01 ? 'SETTLED (PAID)' : 'PARTIAL';
    else if (lastEv.type === 'DEPOSIT_CLEARED') status = 'CLEARED';
  }
  if (!check.finalStatus) {
    const totalReplaced = sortedEvents.filter(e => e.type === 'REPLACEMENT').reduce((s, e) => s + (e.amount ?? 0), 0);
    if (totalReplaced >= check.originalAmount - 0.01) return { status: 'REPLACED', holdCount, returnCount, totalPaid };
    for (let j = sortedEvents.length - 1; j >= 0; j--) {
      const ev = sortedEvents[j];
      if (ev.type === 'DEPOSIT_CLEARED') { status = 'CLEARED'; break; }
      if (ev.type === 'REPLACEMENT') { status = 'REPLACED'; break; }
      if (ev.type === 'SETTLED_PAID') { status = 'SETTLED (PAID)'; break; }
      if (ev.type === 'DEPOSITED') { status = 'DEPOSITED'; break; }
      if (ev.type === 'CANCELLATION') { status = 'CANCELLED'; break; }
      if (ev.type === 'BAD_ACCOUNT') { status = 'BAD ACCOUNT'; break; }
      if (ev.type === 'ALTERATION') { status = 'ALTERATION'; break; }
      if (ev.type === 'LEGAL') { status = 'LEGAL'; break; }
      if (ev.type === 'RECONSTRUCT') { status = 'RECONSTRUCT'; break; }
      if (ev.type === 'RETURN') { status = 'RETURNED'; break; }
      if (ev.type === 'HOLD_REQUEST') {
        const lastReturnIdx = (() => { for (let k = sortedEvents.length - 1; k >= 0; k--) if (sortedEvents[k].type === 'RETURN') return k; return -1; })();
        const hasDepositAfterLastReturn = sortedEvents.some((e, k) => (e.type === 'DEPOSITED' || e.type === 'DEPOSIT_CLEARED') && k > lastReturnIdx);
        if (!hasDepositAfterLastReturn) { status = 'HELD'; break; }
        continue;
      }
      if (ev.type === 'PARTIAL_PAYMENT') { status = (check.originalAmount - totalPaid) <= 0.01 ? 'SETTLED (PAID)' : 'PARTIAL'; break; }
    }
  }
  // Auto-deposit for CAN'T OUS
  if (status === 'RETURNED') {
    const lastReturn = [...sortedEvents].reverse().find(e => e.type === 'RETURN');
    if (lastReturn && lastReturn.reason?.toUpperCase() === "CAN'T OUS") {
      const baseDt = new Date((lastReturn.eventDate ?? check.checkDate ?? '') + 'T00:00:00');
      baseDt.setHours(0, 0, 0, 0);
      const day = baseDt.getDay();
      let addDays = 1; if (day === 5) addDays = 3; else if (day === 6) addDays = 2;
      const autoDepositDate = new Date(baseDt.getTime() + addDays * 86400000);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (today >= autoDepositDate) status = 'DEPOSITED';
    }
  }
  // Auto-clear after 5 banking days
  if (status === 'DEPOSITED') {
    let depositStartDate = null;
    for (let j = sortedEvents.length - 1; j >= 0; j--) { const ev = sortedEvents[j]; if (ev.type === 'HOLD_REQUEST' && ev.moveDate) { depositStartDate = ev.moveDate; break; } }
    if (!depositStartDate) { const d = [...sortedEvents].reverse().find(e => e.type === 'DEPOSITED'); if (d?.eventDate) depositStartDate = d.eventDate; }
    if (!depositStartDate) {
      const lastReturn = [...sortedEvents].reverse().find(e => e.type === 'RETURN');
      if (lastReturn && lastReturn.reason?.toUpperCase() === "CAN'T OUS") {
        const baseDt = new Date((lastReturn.eventDate ?? check.checkDate ?? '') + 'T00:00:00');
        baseDt.setHours(0, 0, 0, 0);
        const day = baseDt.getDay();
        let addDays = 1; if (day === 5) addDays = 3; else if (day === 6) addDays = 2;
        depositStartDate = new Date(baseDt.getTime() + addDays * 86400000).toISOString().slice(0, 10);
      }
    }
    if (depositStartDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const depDate = new Date(depositStartDate + 'T00:00:00');
      let bankingDays = 0; const cursor = new Date(depDate);
      while (bankingDays < 5) { cursor.setDate(cursor.getDate() + 1); const dow = cursor.getDay(); if (dow !== 0 && dow !== 6) bankingDays++; }
      if (today >= cursor) status = 'CLEARED';
    }
  }
  return { status, holdCount, returnCount, totalPaid };
}

function tally(checks, events) {
  const evMap = new Map();
  for (const e of events) { if (!evMap.has(e.checkId)) evMap.set(e.checkId, []); evMap.get(e.checkId).push(e); }
  evMap.forEach(arr => arr.sort(compareEvents));
  const counts = {};
  const byStatus = new Map();
  for (const c of checks) {
    const { status } = computeCheckStatus(c, evMap.get(c.id) ?? []);
    counts[status] = (counts[status] ?? 0) + 1;
    if (!byStatus.has(status)) byStatus.set(status, new Set());
    byStatus.get(status).add(c.id);
  }
  return { counts, byStatus };
}

// ── Load RDS (portal) ──
const c = new pg.Client({ connectionString: portalEnv.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const S = 'check_monitoring';
const rdsChecks = (await c.query(`SELECT id, check_no AS "checkNo", check_date AS "checkDate", original_amount AS "originalAmount", final_status AS "finalStatus" FROM ${S}.checks`)).rows
  .map(r => ({ id: r.id, checkNo: r.checkNo, checkDate: dstr(r.checkDate), originalAmount: parseFloat(r.originalAmount) || 0, finalStatus: r.finalStatus }));
const rdsEvents = (await c.query(`SELECT check_id AS "checkId", type, event_date AS "eventDate", move_date AS "moveDate", reason, amount, recorded_at AS "recordedAt" FROM ${S}.events`)).rows
  .map(r => ({ checkId: r.checkId, type: r.type, eventDate: dstr(r.eventDate), moveDate: dstr(r.moveDate), reason: r.reason, amount: r.amount == null ? null : parseFloat(r.amount), recordedAt: tstr(r.recordedAt) }));
await c.end();

// ── Load Supabase (orig) ──
async function sbAll(table, orderBy = 'created_at') {
  const all = []; let off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/${table}?select=*&order=${orderBy}.asc&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || d.length === 0) break;
    all.push(...d); if (d.length < 1000) break; off += 1000;
  }
  return all;
}
const sbChecksRaw = await sbAll('checks');
const sbEventsRaw = await sbAll('events', 'recorded_at');
const sbChecks = sbChecksRaw.map(r => ({ id: r.id, checkNo: r.check_no, checkDate: r.check_date, originalAmount: parseFloat(r.original_amount) || 0, finalStatus: r.final_status }));
const sbEvents = sbEventsRaw.map(r => ({ checkId: r.check_id, type: r.type, eventDate: r.event_date, moveDate: r.move_date, reason: r.reason, amount: r.amount == null ? null : parseFloat(r.amount), recordedAt: r.recorded_at }));

const rds = tally(rdsChecks, rdsEvents);
const sb = tally(sbChecks, sbEvents);

const allStatuses = [...new Set([...Object.keys(rds.counts), ...Object.keys(sb.counts)])].sort();
console.log('STATUS'.padEnd(18), 'PORTAL(RDS)'.padStart(12), 'ORIG(SB)'.padStart(10), 'DIFF'.padStart(6));
console.log('-'.repeat(50));
for (const s of allStatuses) {
  const rc = rds.counts[s] ?? 0, sc = sb.counts[s] ?? 0;
  const flag = rc !== sc ? '  <== DIFF' : '';
  console.log(s.padEnd(18), String(rc).padStart(12), String(sc).padStart(10), String(rc - sc).padStart(6), flag);
}
console.log('-'.repeat(50));
console.log('TOTAL'.padEnd(18), String(rdsChecks.length).padStart(12), String(sbChecks.length).padStart(10));

// Show which IDs differ for HELD / RETURNED / PARTIAL
for (const s of ['HELD', 'RETURNED', 'PARTIAL']) {
  const rSet = rds.byStatus.get(s) ?? new Set();
  const sSet = sb.byStatus.get(s) ?? new Set();
  const onlyRds = [...rSet].filter(id => !sSet.has(id));
  const onlySb = [...sSet].filter(id => !rSet.has(id));
  if (onlyRds.length || onlySb.length) {
    console.log(`\n${s}: only in PORTAL (${onlyRds.length}):`, onlyRds.slice(0, 10));
    console.log(`${s}: only in ORIG   (${onlySb.length}):`, onlySb.slice(0, 10));
  }
}
