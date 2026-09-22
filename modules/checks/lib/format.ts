/** Shared formatting helpers used across all UI pages */

export function fmtPHP(n: number | null | undefined): string {
  if (n == null) return '—';
  return '₱' + Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  });
}

/** Format an ISO timestamp to Philippine time (UTC+8), e.g. "2026-07-01 10:58" */
export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  // Convert to PH time (UTC+8)
  return d.toLocaleString('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '').replace('T', ' ').slice(0, 16);
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const EVENT_LABELS: Record<string, string> = {
  HOLD_REQUEST:    'Hold Request',
  RETURN:          'Return',
  PARTIAL_PAYMENT: 'Partial Payment',
  DEPOSIT_CLEARED: 'Deposit Cleared',
  REPLACEMENT:     'Replacement',
  DEPOSITED:       'Deposited',
  CANCELLATION:    'Cancellation',
  ALTERATION:      'Alteration',
  LEGAL:           'Legal Action',
  RECONSTRUCT:     'Reconstruct',
  NOTE:            'Note',
};

export const RETURN_REASONS = [
  'DAIF','DAUD','DAIF/DAUD','DAUD/DAIF','DAIF/ACCOUNT CLOSED','DAUD/ACCOUNT CLOSED',
  'TWICE DAIF','ACCT CLOSED','STOP PAYMENT',
  'SIGNATURE MISMATCH','POSTDATED','STALE','ENDORSEMENT IRREGULAR',
  'UNDER GARNISHMENT',"CAN'T OUS","TWICE CAN'T OUS",'DORMANT ACCOUNT','ALT. - AWFD','BSP MEMO','UNAUTHORIZED SIGNATORY','OTHER',
];

export const PAYMENT_METHODS = [
  'CASH','BANK TRANSFER (BTB)','GCASH','MAYA','CREDIT MEMO','REPLACEMENT CHECK','OTHER',
];

/** Methods for "Settle Paid" — all except REPLACEMENT CHECK */
export const SETTLE_METHODS = [
  'CASH','BANK TRANSFER (BTB)','GCASH','MAYA','CREDIT MEMO','OTHER',
];

/** Methods for "Mark Replaced" — REPLACEMENT CHECK and OTHER only */
export const REPLACE_METHODS = [
  'REPLACEMENT CHECK','OTHER',
];

export const PAYMENT_FOR_OPTIONS = ['MACHINE', 'CONS', 'PARTS', 'OTHERS', 'RECONSTRUCT BALANCE'];

export const STALE_DAYS = 180;
