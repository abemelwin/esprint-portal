/**
 * POST /api/admin/sync
 *
 * Syncs new data from Supabase → RDS for checks, events, clients, and
 * check_notes. Safe to call multiple times (ON CONFLICT DO NOTHING).
 * Then resolves any remaining UUID recorded_by → display names.
 *
 * Protected by a sync secret token (SYNC_SECRET env var).
 * Called daily by GitHub Actions cron job.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "sync-esprint-2026";
const SB_URL      = process.env.SUPABASE_URL;
const SB_KEY      = process.env.SUPABASE_SERVICE_KEY;
const SCHEMA      = "check_monitoring";
const UUID_RE     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sbGetAll(table: string, orderBy = "created_at"): Promise<any[]> {
  if (!SB_URL || !SB_KEY) throw new Error("Supabase env vars not set");
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const all: any[] = [];
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const r = await fetch(
      `${SB_URL}/rest/v1/${table}?select=*&order=${orderBy}.asc&limit=${PAGE}&offset=${offset}`,
      { headers }
    );
    const batch = await r.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function buildUserMap(): Promise<Map<string, string>> {
  if (!SB_URL || !SB_KEY) return new Map();
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const map = new Map<string, string>();
  let page = 1;
  for (;;) {
    const r = await fetch(
      `${SB_URL}/auth/v1/admin/users?per_page=1000&page=${page}`,
      { headers }
    );
    const data = await r.json();
    const users = data.users ?? [];
    for (const u of users) {
      const meta = u.user_metadata ?? {};
      map.set(u.id, meta.full_name ?? meta.name ?? u.email ?? u.id);
    }
    if (users.length < 1000) break;
    page++;
  }
  return map;
}

export async function POST(req: NextRequest) {
  // Verify secret
  const auth = req.headers.get("x-sync-secret") ?? req.nextUrl.searchParams.get("secret");
  if (auth !== SYNC_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!SB_URL || !SB_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase env vars not configured." }, { status: 500 });
  }

  const results: Record<string, number> = {};

  try {
    // ── Clients ──────────────────────────────────────────────────────────────
    const sbClients = await sbGetAll("clients");
    const rdsClients = await query<{ code: string }>(`SELECT code FROM ${SCHEMA}.clients`);
    const existingCodes = new Set(rdsClients.map(r => r.code));
    let clientsAdded = 0;
    for (const c of sbClients) {
      if (existingCodes.has(c.code)) continue;
      await query(
        `INSERT INTO ${SCHEMA}.clients (code, name, branch_id, ae)
         VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name, c.branch_id ?? null, c.ae ?? null]
      );
      clientsAdded++;
    }
    results.clients = clientsAdded;

    // ── Checks ───────────────────────────────────────────────────────────────
    const sbChecks = await sbGetAll("checks");
    const rdsChecks = await query<{ id: string }>(`SELECT id FROM ${SCHEMA}.checks`);
    const existingCheckIds = new Set(rdsChecks.map(r => r.id));
    let checksAdded = 0;
    for (const c of sbChecks) {
      if (existingCheckIds.has(c.id)) continue;
      await query(
        `INSERT INTO ${SCHEMA}.checks
          (id,client_code,branch_id,subsidiary,ae,bank,check_no,check_date,
           original_amount,payment_for,payment_description,notes,final_status,
           blacklist_reason,replacement_of,created_by,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.client_code, c.branch_id, c.subsidiary ?? null, c.ae ?? null,
         c.bank ?? null, c.check_no, c.check_date ?? null, c.original_amount,
         c.payment_for ?? null, c.payment_description ?? '', c.notes ?? '',
         c.final_status ?? null, c.blacklist_reason ?? null, c.replacement_of ?? null,
         c.created_by ?? null, c.created_at]
      );
      checksAdded++;
    }
    results.checks = checksAdded;

    // ── Events ───────────────────────────────────────────────────────────────
    const sbEvents = await sbGetAll("events", "recorded_at");
    const rdsEvents = await query<{ id: string }>(`SELECT id FROM ${SCHEMA}.events`);
    const existingEventIds = new Set(rdsEvents.map(r => r.id));
    let eventsAdded = 0;
    for (const e of sbEvents) {
      if (existingEventIds.has(e.id)) continue;
      await query(
        `INSERT INTO ${SCHEMA}.events
          (id,check_id,type,event_date,move_date,reason,method,reference,
           amount,notes,recorded_by,recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.check_id, e.type, e.event_date ?? null, e.move_date ?? null,
         e.reason ?? null, e.method ?? null, e.reference ?? null,
         e.amount ?? null, e.notes ?? '', e.recorded_by ?? null, e.recorded_at]
      );
      eventsAdded++;
    }
    results.events = eventsAdded;

    // ── Check Notes ───────────────────────────────────────────────────────────
    const sbNotes = await sbGetAll("check_notes", "created_at");
    const rdsNotes = await query<{ id: string }>(`SELECT id FROM ${SCHEMA}.check_notes`);
    const existingNoteIds = new Set(rdsNotes.map(r => r.id));
    let notesAdded = 0;
    for (const n of sbNotes) {
      if (existingNoteIds.has(n.id)) continue;
      await query(
        `INSERT INTO ${SCHEMA}.check_notes
          (id,check_id,content,created_by,created_by_name,created_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [n.id, n.check_id, n.content, n.created_by ?? '', n.created_by_name ?? '', n.created_at]
      );
      notesAdded++;
    }
    results.notes = notesAdded;

    // ── Recon Schedule ────────────────────────────────────────────────────────
    const sbSchedule = await sbGetAll("recon_schedule", "sort_order");
    const rdsSchedule = await query<{ id: string }>(`SELECT id FROM ${SCHEMA}.recon_schedule`);
    const existingSchedIds = new Set(rdsSchedule.map(r => r.id));
    let schedAdded = 0;
    for (const s of sbSchedule) {
      if (existingSchedIds.has(s.id)) continue;
      await query(
        `INSERT INTO ${SCHEMA}.recon_schedule
          (id, client_code, schedule_date, monthly_amortization, amount, payment_details, sort_order, event_id, check_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.client_code, s.schedule_date ?? null, s.monthly_amortization ?? null,
         s.amount ?? null, s.payment_details ?? null, s.sort_order ?? 0,
         s.event_id ?? null, s.check_id ?? null, s.updated_at ?? new Date().toISOString()]
      );
      schedAdded++;
    }
    results.schedule = schedAdded;

    // ── Resolve UUID → display names ─────────────────────────────────────────
    const userMap = await buildUserMap();
    let resolved = 0;
    for (const [table, col] of [
      [SCHEMA + ".events",      "recorded_by"],
      [SCHEMA + ".checks",      "created_by"],
      [SCHEMA + ".check_notes", "created_by"],
    ] as [string, string][]) {
      const rows = await query<{ id: string; v: string }>(
        `SELECT id, ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL`
      );
      for (const r of rows) {
        if (!UUID_RE.test(r.v)) continue;
        const name = userMap.get(r.v);
        if (!name) continue;
        await query(`UPDATE ${table} SET ${col} = $1 WHERE id = $2`, [name, r.id]);
        resolved++;
      }
    }
    results.namesResolved = resolved;

    // ── Remove checks deleted from Supabase ──────────────────────────────────
    const sbCheckIds = new Set(sbChecks.map((c: any) => c.id as string));
    const rdsAllChecks = await query<{ id: string }>(`SELECT id FROM ${SCHEMA}.checks`);
    let deletedCount = 0;
    for (const r of rdsAllChecks) {
      if (!sbCheckIds.has(r.id)) {
        await query(`DELETE FROM ${SCHEMA}.events WHERE check_id = $1`, [r.id]);
        await query(`DELETE FROM ${SCHEMA}.check_notes WHERE check_id = $1`, [r.id]);
        await query(`DELETE FROM ${SCHEMA}.checks WHERE id = $1`, [r.id]);
        deletedCount++;
      }
    }
    results.deleted = deletedCount;

    // ── Remove events deleted from Supabase (keeps status counts accurate) ───
    const sbEventIds = new Set(sbEvents.map((e: any) => e.id as string));
    const rdsAllEvents = await query<{ id: string }>(`SELECT id FROM ${SCHEMA}.events`);
    let deletedEvents = 0;
    for (const r of rdsAllEvents) {
      if (!sbEventIds.has(r.id)) {
        await query(`DELETE FROM ${SCHEMA}.events WHERE id = $1`, [r.id]);
        deletedEvents++;
      }
    }
    results.deletedEvents = deletedEvents;

    // ── Remove notes deleted from Supabase ───────────────────────────────────
    const sbNoteIds = new Set(sbNotes.map((n: any) => n.id as string));
    const rdsAllNotes = await query<{ id: string }>(`SELECT id FROM ${SCHEMA}.check_notes`);
    let deletedNotes = 0;
    for (const r of rdsAllNotes) {
      if (!sbNoteIds.has(r.id)) {
        await query(`DELETE FROM ${SCHEMA}.check_notes WHERE id = $1`, [r.id]);
        deletedNotes++;
      }
    }
    results.deletedNotes = deletedNotes;

    return NextResponse.json({
      ok: true,
      synced: results,
      message: `Sync complete: +${results.clients} clients, +${results.checks} checks, +${results.events} events, +${results.notes} notes, ${results.namesResolved} names resolved, ${results.deleted} deleted.`,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
