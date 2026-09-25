/**
 * computeStatus.ts — full port of _writeChecksView logic from Code.gs
 */
import type { Check, CheckEvent, Client, BranchRow, CheckStatus } from './database.types';
import { fmtDateTime } from './format';

export interface CheckViewRow {
  subsidiary:  string;
  branch:      string;
  clientName:  string;
  ae:          string;
  bank:        string;
  checkNo:     string;
  checkDate:   string;
  amount:      number;
  paymentFor:  string;
  description: string;
  notes:       string;
  status:      CheckStatus;
  reason:      string;
  holdCount:   number;
  returnCount: number;
  nextDeposit: string;
  agingDays:   number | '';
  encodedBy:   string;
  encodedAt:   string;
}

export interface ComputeStatusOptions {
  checks:   Check[];
  events:   CheckEvent[];
  clients:  Client[];
  branches: BranchRow[];
}

/**
 * Chronological comparator for events.
 * Primary: eventDate. Tie-breaker: recordedAt (actual creation time).
 * This ensures events on the same date are ordered by when they were actually
 * recorded — critical for determining the true latest event (e.g. Return then
 * Hold Request on the same day should resolve to HELD, not RETURNED).
 */
export function compareEvents(a: CheckEvent, b: CheckEvent): number {
  const dateCmp = (a.eventDate ?? '').localeCompare(b.eventDate ?? '');
  if (dateCmp !== 0) return dateCmp;
  const recCmp = (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '');
  if (recCmp !== 0) return recCmp;
  // Deterministic tie-breaker when eventDate AND recordedAt are identical.
  // Otherwise ordering depends on DB row order (differs between RDS and the
  // original Supabase source). The ORIGINAL system's natural fetch order puts
  // RETURN before PARTIAL_PAYMENT, so PARTIAL_PAYMENT ends up LAST and the
  // check resolves to PARTIAL. Order RETURN (0) before PARTIAL_PAYMENT (1) to
  // reproduce that exact result (matches the orig dashboard).
  const order: Record<string, number> = { RETURN: 0, PARTIAL_PAYMENT: 1 };
  return (order[a.type] ?? 0) - (order[b.type] ?? 0);
}

/**
 * Normalize raw status string to a standard CheckStatus.
 * Handles legacy/imported variations like 'BSP MEMO', 'BSP MEMO XX', 'ALT', etc.
 */
export function normalizeStatus(raw: string | null | undefined): CheckStatus {
  if (!raw) return 'OPEN';
  const s = raw.trim().toUpperCase();
  if (s.startsWith('BSP MEMO') || s.startsWith('ALT')) return 'ALTERATION';
  if (s === 'RECON' || s.startsWith('RECONSTRUCT')) return 'RECONSTRUCT';
  if (s === 'HOLD' || s === 'HELD') return 'HELD';
  if (s === 'RETURN' || s === 'RETURNED') return 'RETURNED';
  if (s === 'CLEAR' || s === 'CLEARED') return 'CLEARED';
  if (s === 'DEPOSIT' || s === 'DEPOSITED') return 'DEPOSITED';
  if (s === 'CANCEL' || s === 'CANCELLED') return 'CANCELLED';
  if (s === 'LEGAL') return 'LEGAL';
  if (s === 'BAD ACCOUNT' || s === 'BAD_ACCOUNT') return 'BAD ACCOUNT';
  if (s === 'PARTIAL' || s === 'PARTIAL_PAYMENT') return 'PARTIAL';
  if (s === 'SETTLED' || s.startsWith('SETTLED')) return 'SETTLED (PAID)';
  if (s === 'REPLACED' || s === 'REPLACEMENT') return 'REPLACED';
  return raw as CheckStatus;
}

export function computeCheckStatus(
  check: Check,
  sortedEvents: CheckEvent[],
): { status: CheckStatus; holdCount: number; returnCount: number; totalPaid: number } {
  const normFinal = check.finalStatus ? normalizeStatus(check.finalStatus) : null;
  let status: CheckStatus = normFinal || 'OPEN';
  let holdCount   = 0;
  let returnCount = 0;
  let totalPaid   = 0;

  for (const ev of sortedEvents) {
    if (ev.type === 'HOLD_REQUEST') holdCount++;
    if (ev.type === 'RETURN')       returnCount++;
    if (ev.type === 'PARTIAL_PAYMENT' || ev.type === 'REPLACEMENT' || ev.type === 'SETTLED_PAID') totalPaid += ev.amount ?? 0;
  }

  // Override: if finalStatus exists but last event is a payment/settlement/clear/alteration, use event-based status.
  if (normFinal && sortedEvents.length > 0) {
    const lastEv = sortedEvents[sortedEvents.length - 1];
    if (lastEv.type === 'SETTLED_PAID') {
      status = 'SETTLED (PAID)';
    } else if (lastEv.type === 'PARTIAL_PAYMENT') {
      status = (check.originalAmount - totalPaid) <= 0.01 ? 'SETTLED (PAID)' : 'PARTIAL';
    } else if (lastEv.type === 'DEPOSIT_CLEARED') {
      status = 'CLEARED';
    } else if (lastEv.type === 'ALTERATION') {
      status = 'ALTERATION';
    }
  }

  if (!normFinal) {
    // If fully paid via replacement/partial, mark settled regardless of later events
    const totalReplaced = sortedEvents
      .filter(e => e.type === 'REPLACEMENT')
      .reduce((s, e) => s + (e.amount ?? 0), 0);
    if (totalReplaced >= check.originalAmount - 0.01) {
      return { status: 'REPLACED', holdCount, returnCount, totalPaid };
    }

    for (let j = sortedEvents.length - 1; j >= 0; j--) {
      const ev = sortedEvents[j];
      if (ev.type === 'DEPOSIT_CLEARED') { status = 'CLEARED';     break; }
      if (ev.type === 'REPLACEMENT')     { status = 'REPLACED';    break; }
      if (ev.type === 'SETTLED_PAID')    { status = 'SETTLED (PAID)'; break; }
      if (ev.type === 'DEPOSITED')       { status = 'DEPOSITED';   break; }
      if (ev.type === 'CANCELLATION')    { status = 'CANCELLED';   break; }
      if (ev.type === 'BAD_ACCOUNT')     { status = 'BAD ACCOUNT'; break; }
      if (ev.type === 'ALTERATION')      { status = 'ALTERATION';  break; }
      if (ev.type === 'LEGAL')           { status = 'LEGAL';       break; }
      if (ev.type === 'RECONSTRUCT')     { status = 'RECONSTRUCT'; break; }
      if (ev.type === 'RETURN')          { status = 'RETURNED';    break; }
      if (ev.type === 'HOLD_REQUEST') {
        // Skip this hold request only if there's a DEPOSITED/CLEARED event that happened
        // AFTER the most recent RETURN (meaning the check was actually deposited and cleared,
        // not just deposited then returned again).
        const lastReturnIdx = (() => {
          for (let k = sortedEvents.length - 1; k >= 0; k--) {
            if (sortedEvents[k].type === 'RETURN') return k;
          }
          return -1;
        })();
        const hasDepositAfterLastReturn = sortedEvents.some(
          (e, k) => (e.type === 'DEPOSITED' || e.type === 'DEPOSIT_CLEARED') && k > lastReturnIdx
        );
        if (!hasDepositAfterLastReturn) { status = 'HELD'; break; }
        // A deposit exists after the last return — this hold is for a check already deposited
        continue;
      }
      if (ev.type === 'PARTIAL_PAYMENT') {
        status = (check.originalAmount - totalPaid) <= 0.01 ? 'SETTLED (PAID)' : 'PARTIAL';
        break;
      }
    }
  }

  // Auto-deposit: if last RETURN reason is "CAN'T OUS", auto-set DEPOSITED on next business day from RETURN EVENT DATE
  // This must run BEFORE auto-clear so the DEPOSITED status is set first
  if (status === 'RETURNED') {
    const lastReturn = [...sortedEvents].reverse().find(e => e.type === 'RETURN');
    if (lastReturn && lastReturn.reason?.toUpperCase() === "CAN'T OUS") {
      const baseDt = new Date((lastReturn.eventDate ?? check.checkDate ?? '') + 'T00:00:00');
      baseDt.setHours(0, 0, 0, 0);
      const day = baseDt.getDay();
      let addDays = 1;
      if (day === 5) addDays = 3;
      else if (day === 6) addDays = 2;
      const autoDepositDate = new Date(baseDt.getTime() + addDays * 86400000);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today >= autoDepositDate) {
        status = 'DEPOSITED';
      }
    }
  }

  // Auto-clear: if status is DEPOSITED and 5+ banking days have passed since the deposit date
  if (status === 'DEPOSITED') {
    let depositStartDate: string | null = null;
    // 1. HOLD_REQUEST moveDate
    for (let j = sortedEvents.length - 1; j >= 0; j--) {
      const ev = sortedEvents[j];
      if (ev.type === 'HOLD_REQUEST' && ev.moveDate) { depositStartDate = ev.moveDate; break; }
    }
    // 2. DEPOSITED event date
    if (!depositStartDate) {
      const depositedEv = [...sortedEvents].reverse().find(e => e.type === 'DEPOSITED');
      if (depositedEv?.eventDate) depositStartDate = depositedEv.eventDate;
    }
    // 3. CAN'T OUS — auto-computed deposit date (next business day from return event date)
    if (!depositStartDate) {
      const lastReturn = [...sortedEvents].reverse().find(e => e.type === 'RETURN');
      if (lastReturn && lastReturn.reason?.toUpperCase() === "CAN'T OUS") {
        const baseDt = new Date((lastReturn.eventDate ?? check.checkDate ?? '') + 'T00:00:00');
        baseDt.setHours(0, 0, 0, 0);
        const day = baseDt.getDay();
        let addDays = 1;
        if (day === 5) addDays = 3;
        else if (day === 6) addDays = 2;
        const autoDeposit = new Date(baseDt.getTime() + addDays * 86400000);
        depositStartDate = autoDeposit.toISOString().slice(0, 10);
      }
    }
    if (depositStartDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const depDate = new Date(depositStartDate + 'T00:00:00');
      let bankingDays = 0;
      const cursor = new Date(depDate);
      while (bankingDays < 5) {
        cursor.setDate(cursor.getDate() + 1);
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) bankingDays++;
      }
      if (today >= cursor) {
        status = 'CLEARED';
      }
    }
  }

  return { status, holdCount, returnCount, totalPaid };
}

/**
 * Group and sort all events by checkId in a single O(E log E) pass.
 * Replaces repeated O(C * E) event filtering across pages.
 */
export function groupSortedEvents(events: CheckEvent[]): Map<string, CheckEvent[]> {
  const map = new Map<string, CheckEvent[]>();
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    let arr = map.get(ev.checkId);
    if (!arr) {
      arr = [];
      map.set(ev.checkId, arr);
    }
    arr.push(ev);
  }
  map.forEach((arr) => arr.sort(compareEvents));
  return map;
}

/** Sort events for a given check ID from a flat events array */
export function sortedEventsFor(checkId: string, events: CheckEvent[]): CheckEvent[] {
  return events
    .filter(e => e.checkId === checkId)
    .sort(compareEvents);
}

export function buildChecksView(opts: ComputeStatusOptions): CheckViewRow[] {
  const { checks, events, clients, branches } = opts;

  const clientMap = new Map<string, Client>();
  for (const c of clients) clientMap.set(c.code, c);

  const branchMap = new Map<string, string>();
  for (const b of branches) branchMap.set(b.id, b.name);

  // Group events by checkId in a single pass O(E) rather than O(C * E) filter in loop
  const eventsMap = groupSortedEvents(events);
  const today = new Date().toISOString().slice(0, 10);
  const rows: CheckViewRow[] = [];

  for (const c of checks) {
    const evs = eventsMap.get(c.id) ?? [];
    const { status, holdCount, returnCount } = computeCheckStatus(c, evs);

    let reason = '';
    for (let j = evs.length - 1; j >= 0; j--) {
      if (evs[j].reason) { reason = evs[j].reason!; break; }
      if (evs[j].method) { reason = evs[j].method!; break; }
    }

    let nextDeposit = '';
    for (let j = evs.length - 1; j >= 0; j--) {
      const ev = evs[j];
      if ((ev.type === 'HOLD_REQUEST' || ev.type === 'RECONSTRUCT') && ev.moveDate) { nextDeposit = ev.moveDate; break; }
      if (ev.type === 'RETURN' || ev.type === 'DEPOSIT_CLEARED') break;
    }
    if (!nextDeposit) nextDeposit = c.checkDate ?? '';

    let agingDays: number | '' = '';
    const lastEvDate = evs.length ? evs[evs.length - 1].eventDate : c.checkDate;
    if (lastEvDate) {
      const diff = Math.floor(
        (new Date(today).getTime() - new Date(lastEvDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      agingDays = diff >= 0 ? diff : '';
    }

    rows.push({
      subsidiary:  c.subsidiary ?? '',
      branch:      branchMap.get(c.branch) ?? c.branch ?? '',
      clientName:  clientMap.get(c.client)?.name ?? '',
      ae:          c.ae ?? '',
      bank:        c.bank ?? '',
      checkNo:     c.checkNo ?? '',
      checkDate:   c.checkDate ?? '',
      amount:      c.originalAmount ?? 0,
      paymentFor:  c.paymentFor ?? '',
      description: c.paymentDescription ?? '',
      notes:       c.notes ?? '',
      status,
      reason,
      holdCount,
      returnCount,
      nextDeposit,
      agingDays,
      encodedBy:   c.createdBy ?? '',
      encodedAt:   c.createdAt ? fmtDateTime(c.createdAt) : '',
    });
  }

  return rows;
}
