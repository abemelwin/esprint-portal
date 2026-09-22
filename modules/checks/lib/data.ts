/**
 * Check Monitoring — RDS data-access layer.
 *
 * Replaces the old Supabase serverLoad/serverSave (esprint-check-monitoring/
 * lib/db.ts) with plain PostgreSQL queries against the `check_monitoring`
 * schema on AWS RDS.
 *
 * The pure business logic (computeStatus.ts, mappers.ts) is reused verbatim,
 * so status/balance computation is identical to the original system.
 */

import { query, transaction } from "@/lib/db";
import {
  rowToCheck,
  rowToEvent,
  rowToClient,
  checkToRow,
  eventToRow,
} from "./mappers";
import {
  buildChecksView,
  computeCheckStatus,
  groupSortedEvents,
} from "./computeStatus";
import type {
  AppData,
  Check,
  CheckEvent,
  CheckMeta,
  CheckRow,
  EventRow,
  ClientRow,
  BranchRow,
  BankRow,
  CheckStatus,
} from "./database.types";

const SCHEMA = "check_monitoring";

// ─── Individual table reads ───────────────────────────────────────

async function readChecks(): Promise<Check[]> {
  const rows = await query<CheckRow>(
    `SELECT * FROM ${SCHEMA}.checks ORDER BY created_at DESC`
  );
  return rows.map(rowToCheck);
}

async function readEvents(): Promise<CheckEvent[]> {
  const rows = await query<EventRow>(
    `SELECT * FROM ${SCHEMA}.events ORDER BY event_date, recorded_at`
  );
  return rows.map(rowToEvent);
}

async function readClients(): Promise<ReturnType<typeof rowToClient>[]> {
  const rows = await query<ClientRow>(
    `SELECT * FROM ${SCHEMA}.clients ORDER BY name`
  );
  return rows.map(rowToClient);
}

async function readBranches(): Promise<BranchRow[]> {
  return query<BranchRow>(`SELECT * FROM ${SCHEMA}.branches ORDER BY name`);
}

async function readSubsidiaries(): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT name FROM ${SCHEMA}.subsidiaries ORDER BY name`
  );
  return rows.map((r) => r.name);
}

async function readAeList(): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT name FROM ${SCHEMA}.ae_list ORDER BY name`
  );
  return rows.map((r) => r.name);
}

async function readBanks(): Promise<BankRow[]> {
  return query<BankRow>(`SELECT * FROM ${SCHEMA}.banks ORDER BY name`);
}

async function readNotesCounts(): Promise<Record<string, number>> {
  const rows = await query<{ check_id: string; n: string }>(
    `SELECT check_id, count(*)::text AS n FROM ${SCHEMA}.check_notes GROUP BY check_id`
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.check_id] = Number(r.n);
  return out;
}

// ─── Derived per-check metadata (status, balance, etc.) ───────────

/**
 * Compute the CHECKS_META map (status/balance/reason/nextDeposit per
 * check) using the exact same logic as the original system.
 */
function computeMeta(
  checks: Check[],
  events: CheckEvent[]
): Record<string, CheckMeta> {
  const eventsMap = groupSortedEvents(events);
  const meta: Record<string, CheckMeta> = {};

  for (const c of checks) {
    const evs = eventsMap.get(c.id) ?? [];
    const { status, holdCount, returnCount, totalPaid } = computeCheckStatus(
      c,
      evs
    );

    const balance = Math.max(0, (c.originalAmount ?? 0) - totalPaid);

    // latest reason (mirrors buildChecksView)
    let reason: string | null = null;
    for (let j = evs.length - 1; j >= 0; j--) {
      if (evs[j].reason) { reason = evs[j].reason!; break; }
      if (evs[j].method) { reason = evs[j].method!; break; }
    }

    // next deposit date
    let nextDeposit: string | null = null;
    for (let j = evs.length - 1; j >= 0; j--) {
      const ev = evs[j];
      if ((ev.type === "HOLD_REQUEST" || ev.type === "RECONSTRUCT") && ev.moveDate) {
        nextDeposit = ev.moveDate;
        break;
      }
      if (ev.type === "RETURN" || ev.type === "DEPOSIT_CLEARED") break;
    }
    if (!nextDeposit) nextDeposit = c.checkDate ?? null;

    meta[c.id] = {
      status: status as CheckStatus,
      balance,
      totalPaid,
      holdCount,
      returnCount,
      nextDeposit,
      reason,
      paymentDetails: null,
    };
  }

  return meta;
}

// ─── serverLoad — the main data hydration entry point ─────────────

export interface LoadOptions {
  /** Slim mode omits the raw EVENTS array and relies on CHECKS_META. */
  slim?: boolean;
  /** Skip the short-lived cache and force a fresh DB read. */
  fresh?: boolean;
}

// Short-lived in-memory cache. The dashboard + list pages hit the same
// data; caching for a few seconds avoids re-querying RDS on every
// navigation (which is slow from a remote network). Invalidated on write.
let _cache: { data: AppData; at: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/** Clear the cache — call after any write (insert/update/delete). */
export function invalidateCache(): void {
  _cache = null;
}

export async function serverLoad(opts: LoadOptions = {}): Promise<AppData> {
  // No database configured yet (dev mode before AWS RDS is wired):
  // return an empty dataset so the UI renders without crashing.
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    return {
      CHECKS: [],
      EVENTS: [],
      CLIENTS: [],
      BRANCHES: [],
      SUBSIDIARIES: [],
      AE_LIST: [],
      BANKS: [],
      NOTES_COUNTS: {},
      CHECKS_META: {},
      __warnings: ["No database configured — showing empty data (dev mode)."],
    };
  }

  // Serve from cache if fresh enough (avoids slow re-query on navigation)
  if (!opts.fresh && _cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.data;
  }

  // Run sequentially (not Promise.all) — the RDS free tier can be slow
  // to open many simultaneous connections; reusing one pooled connection
  // at a time is far more reliable.
  const checks = await readChecks();
  const events = await readEvents();
  const clients = await readClients();
  const branches = await readBranches();
  const subsidiaries = await readSubsidiaries();
  const aeList = await readAeList();
  const banks = await readBanks();
  const notesCounts = await readNotesCounts();

  const CHECKS_META = computeMeta(checks, events);

  const data: AppData = {
    CHECKS: checks,
    EVENTS: opts.slim ? [] : events,
    CLIENTS: clients,
    BRANCHES: branches,
    SUBSIDIARIES: subsidiaries,
    AE_LIST: aeList,
    BANKS: banks,
    NOTES_COUNTS: notesCounts,
    CHECKS_META,
  };

  // Cache the full (non-slim) result for subsequent navigations
  if (!opts.slim) {
    _cache = { data, at: Date.now() };
  }

  return data;
}

/** Build the flat "checks view" (for the All Checks table / exports). */
export async function getChecksView() {
  const [checks, events, clients, branches] = await Promise.all([
    readChecks(),
    readEvents(),
    readClients(),
    readBranches(),
  ]);
  return buildChecksView({ checks, events, clients, branches });
}

/** Fetch a single check plus its sorted events. */
export async function getCheckWithEvents(
  checkId: string
): Promise<{ check: Check | null; events: CheckEvent[] }> {
  const [checkRows, eventRows] = await Promise.all([
    query<CheckRow>(`SELECT * FROM ${SCHEMA}.checks WHERE id = $1`, [checkId]),
    query<EventRow>(
      `SELECT * FROM ${SCHEMA}.events WHERE check_id = $1 ORDER BY event_date, recorded_at`,
      [checkId]
    ),
  ]);
  return {
    check: checkRows[0] ? rowToCheck(checkRows[0]) : null,
    events: eventRows.map(rowToEvent),
  };
}

// ─── Writes ───────────────────────────────────────────────────────

/** Insert a new check. */
export async function insertCheck(c: Check): Promise<void> {
  const r = checkToRow(c);
  await query(
    `INSERT INTO ${SCHEMA}.checks
       (id, client_code, branch_id, subsidiary, ae, bank, check_no,
        check_date, original_amount, payment_for, payment_description,
        notes, final_status, blacklist_reason, replacement_of, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      r.id, r.client_code, r.branch_id, r.subsidiary, r.ae, r.bank,
      r.check_no, r.check_date, r.original_amount, r.payment_for,
      r.payment_description, r.notes, r.final_status, r.blacklist_reason,
      r.replacement_of, r.created_by, r.created_at,
    ]
  );
}

/** Update an existing check's editable fields. */
export async function updateCheck(c: Check): Promise<void> {
  const r = checkToRow(c);
  await query(
    `UPDATE ${SCHEMA}.checks SET
       client_code = $2, branch_id = $3, subsidiary = $4, ae = $5,
       bank = $6, check_no = $7, check_date = $8, original_amount = $9,
       payment_for = $10, payment_description = $11, notes = $12,
       final_status = $13, blacklist_reason = $14
     WHERE id = $1`,
    [
      r.id, r.client_code, r.branch_id, r.subsidiary, r.ae, r.bank,
      r.check_no, r.check_date, r.original_amount, r.payment_for,
      r.payment_description, r.notes, r.final_status, r.blacklist_reason,
    ]
  );
}

/** Append an event to the ledger. */
export async function insertEvent(e: CheckEvent): Promise<void> {
  const r = eventToRow(e);
  await query(
    `INSERT INTO ${SCHEMA}.events
       (id, check_id, type, event_date, move_date, reason, method,
        reference, amount, notes, recorded_by, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      r.id, r.check_id, r.type, r.event_date, r.move_date, r.reason,
      r.method, r.reference, r.amount, r.notes, r.recorded_by, r.recorded_at,
    ]
  );
}

/** Add a note to a check. */
export async function saveCheckNote(note: {
  id: string;
  checkId: string;
  content: string;
  createdBy: string;
  createdByName: string;
}): Promise<void> {
  await query(
    `INSERT INTO ${SCHEMA}.check_notes
       (id, check_id, content, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5)`,
    [note.id, note.checkId, note.content, note.createdBy, note.createdByName]
  );
}

/**
 * Soft-delete a check: archive it + its events into deleted_checks,
 * then remove from live tables. Runs in a transaction.
 */
export async function softDeleteCheck(
  checkId: string,
  deletedBy: string,
  deletedByName: string
): Promise<void> {
  await transaction(async (client) => {
    const checkRes = await client.query(
      `SELECT * FROM ${SCHEMA}.checks WHERE id = $1`,
      [checkId]
    );
    if (checkRes.rows.length === 0) return;

    const eventsRes = await client.query(
      `SELECT * FROM ${SCHEMA}.events WHERE check_id = $1`,
      [checkId]
    );

    await client.query(
      `INSERT INTO ${SCHEMA}.deleted_checks
         (check_id, check_snapshot, events_snapshot, deleted_by, deleted_by_name)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        checkId,
        JSON.stringify(checkRes.rows[0]),
        JSON.stringify(eventsRes.rows),
        deletedBy,
        deletedByName,
      ]
    );

    // events cascade-delete via FK, but delete explicitly to be safe
    await client.query(`DELETE FROM ${SCHEMA}.events WHERE check_id = $1`, [checkId]);
    await client.query(`DELETE FROM ${SCHEMA}.checks WHERE id = $1`, [checkId]);
  });
}

// ─── Notes read ───────────────────────────────────────────────────

export interface CheckNote {
  id: string;
  checkId: string;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

/** Read all notes for a check, newest first. */
export async function readCheckNotes(checkId: string): Promise<CheckNote[]> {
  const rows = await query<{
    id: string;
    check_id: string;
    content: string;
    created_by: string;
    created_by_name: string;
    created_at: string;
  }>(
    `SELECT * FROM ${SCHEMA}.check_notes WHERE check_id = $1 ORDER BY created_at DESC`,
    [checkId]
  );
  return rows.map((r) => ({
    id: r.id,
    checkId: r.check_id,
    content: r.content,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  }));
}
