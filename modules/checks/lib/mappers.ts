/**
 * mappers.ts
 *
 * Converts between Supabase snake_case row types and the camelCase DTOs
 * that the front-end components consume.
 *
 * Mirrors the field-mapping logic scattered throughout:
 *   – serverLoad (Code.gs) — sheet row → app object
 *   – serverSave (Code.gs) — app object → sheet row
 */

import type {
  Check, CheckEvent, Client,
  CheckRow, EventRow, ClientRow,
} from './database.types';

// ─── CheckRow ↔ Check ─────────────────────────────────────────────────────────

export function rowToCheck(r: CheckRow): Check {
  return {
    id:                 r.id,
    client:             r.client_code,
    branch:             r.branch_id,
    subsidiary:         r.subsidiary,
    ae:                 r.ae,
    bank:               r.bank,
    checkNo:            r.check_no,
    checkDate:          r.check_date,
    originalAmount:     r.original_amount ? Number(r.original_amount) : 0,
    paymentFor:         r.payment_for,
    paymentDescription: r.payment_description ?? '',
    notes:              r.notes ?? '',
    finalStatus:        r.final_status,
    replacementOf:      r.replacement_of,
    createdBy:          r.created_by,
    createdAt:          r.created_at,
    version:            r.version ?? 1,
    blacklistReason:    r.blacklist_reason ?? null,
  };
}

export function checkToRow(c: Check): CheckRow {
  return {
    id:                  c.id,
    client_code:         c.client,
    branch_id:           c.branch,
    subsidiary:          c.subsidiary,
    ae:                  c.ae,
    bank:                c.bank,
    check_no:            c.checkNo,
    check_date:          c.checkDate,
    original_amount:     c.originalAmount,
    payment_for:         c.paymentFor,
    payment_description: c.paymentDescription || null,
    notes:               c.notes || null,
    final_status:        c.finalStatus,
    replacement_of:      c.replacementOf,
    created_by:          c.createdBy,
    created_at:          c.createdAt,
    blacklist_reason:    c.blacklistReason ?? null,
  };
}

// ─── EventRow ↔ CheckEvent ────────────────────────────────────────────────────

export function rowToEvent(r: EventRow): CheckEvent {
  return {
    id:          r.id,
    checkId:     r.check_id,
    type:        r.type,
    eventDate:   r.event_date,
    moveDate:    r.move_date,
    reason:      r.reason,
    method:      r.method,
    reference:   r.reference,
    amount:      r.amount != null ? Number(r.amount) : undefined,
    notes:       r.notes ?? '',
    recordedBy:  r.recorded_by,
    recordedAt:  r.recorded_at,
  };
}

export function eventToRow(e: CheckEvent): EventRow {
  return {
    id:          e.id,
    check_id:    e.checkId,
    type:        e.type,
    event_date:  e.eventDate,
    move_date:   e.moveDate,
    reason:      e.reason,
    method:      e.method,
    reference:   e.reference,
    amount:      e.amount ?? null,
    notes:       e.notes || null,
    recorded_by: e.recordedBy,
    recorded_at: e.recordedAt,
  };
}

// ─── ClientRow ↔ Client ───────────────────────────────────────────────────────

export function rowToClient(r: ClientRow): Client {
  return {
    code:   r.code,
    name:   r.name,
    branch: r.branch_id,
    ae:     r.ae,
  };
}

export function clientToRow(c: Client): ClientRow {
  return {
    code:      c.code,
    name:      c.name,
    branch_id: c.branch,
    ae:        c.ae,
  };
}
