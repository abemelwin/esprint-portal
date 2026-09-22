/**
 * Supabase / TypeScript type definitions
 * Mirrors the SHEET_COLS schema from Code.gs 1-to-1.
 *
 * Run `npx supabase gen types typescript --project-id <id>` to auto-regenerate
 * once the schema is live, then replace this file with the generated output.
 */

// ─── Row types ────────────────────────────────────────────────────────────────

export interface CheckRow {
  id: string;
  client_code: string;
  branch_id: string;
  subsidiary: string | null;
  ae: string | null;
  bank: string | null;
  check_no: string;
  check_date: string | null;           // ISO date string YYYY-MM-DD
  original_amount: number;
  payment_for: string | null;
  payment_description: string | null;
  notes: string | null;
  final_status: string | null;
  replacement_of: string | null;
  created_by: string | null;
  created_at: string;                  // ISO timestamp
  version?: number;
  blacklist_reason: string | null;
}

export interface EventRow {
  id: string;
  check_id: string;
  type: EventType;
  event_date: string | null;           // ISO date
  move_date: string | null;            // ISO date — next deposit date
  reason: string | null;
  method: string | null;
  reference: string | null;
  amount: number | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;                 // ISO timestamp
}

export interface ClientRow {
  code: string;
  name: string;
  branch_id: string;
  ae: string | null;
}

export interface BranchRow {
  id: string;
  name: string;
  subsidiary: string | null;
}

export interface SubsidiaryRow {
  name: string;
}

export interface AeRow {
  name: string;
}

export interface BankRow {
  code: string;
  name: string;
}

export interface CheckNoteRow {
  id: string;                  // uuid PK
  check_id: string;            // FK → checks.id
  content: string;             // the note text
  created_by: string;          // user id
  created_by_name: string;     // display name or email
  created_at: string;          // ISO timestamp
}

export interface DeletedCheckRow {
  id: string;                    // uuid — row PK
  check_id: string;              // original check id
  check_snapshot: Record<string, unknown>; // full JSON of the check at deletion time
  events_snapshot: Record<string, unknown>[]; // full JSON of all events
  deleted_by: string;            // user id
  deleted_by_name: string;       // display name / email
  deleted_at: string;            // ISO timestamp
}

// ─── Event type enum (maps to every ev.type used in Code.gs) ──────────────────

export type EventType =
  | 'HOLD_REQUEST'
  | 'RETURN'
  | 'DEPOSITED'
  | 'DEPOSIT_CLEARED'
  | 'REPLACEMENT'
  | 'PARTIAL_PAYMENT'
  | 'SETTLED_PAID'
  | 'CANCELLATION'
  | 'ALTERATION'
  | 'LEGAL'
  | 'RECONSTRUCT'
  | 'BAD_ACCOUNT'
  | 'NOTE';

// ─── Check computed status (derived in _writeChecksView / computeCheckStatus) ─

export type CheckStatus =
  | 'OPEN'
  | 'HELD'
  | 'RETURNED'
  | 'DEPOSITED'
  | 'DEPOSIT_CLEARED'
  | 'REPLACED'
  | 'CLEARED'
  | 'CANCELLED'
  | 'ALTERATION'
  | 'LEGAL'
  | 'RECONSTRUCT'
  | 'RECON REPLACED'
  | 'RECON REPLACEMENT'
  | 'SETTLED (PAID)'
  | 'PARTIAL'
  | 'BAD ACCOUNT';

// ─── Application-level DTOs (what the front-end uses) ─────────────────────────

/** The shape components work with (camelCase, derived from CheckRow) */
export interface Check {
  id: string;
  client: string;           // = client_code
  branch: string;           // = branch_id
  subsidiary: string | null;
  ae: string | null;
  bank: string | null;
  checkNo: string;
  checkDate: string | null;
  originalAmount: number;
  paymentFor: string | null;
  paymentDescription: string;
  notes: string;
  finalStatus: string | null;
  replacementOf: string | null;
  createdBy: string | null;
  createdAt: string;
  version?: number;
  blacklistReason: string | null;
}

export interface CheckEvent {
  id: string;
  checkId: string;
  type: EventType;
  eventDate: string | null;
  moveDate: string | null;
  reason: string | null;
  method: string | null;
  reference: string | null;
  amount: number | undefined;
  notes: string;
  recordedBy: string | null;
  recordedAt: string;
}

export interface Client {
  code: string;
  name: string;
  branch: string;           // = branch_id
  ae: string | null;
}

// ─── Full DB load payload (returned by /api/load and serverLoad) ───────────────

export interface AppData {
  CHECKS: Check[];
  EVENTS: CheckEvent[];
  CLIENTS: Client[];
  BRANCHES: BranchRow[];
  SUBSIDIARIES: string[];
  AE_LIST: string[];
  BANKS: BankRow[];
  USERS?: { id: string; email: string; display_name: string | null }[];
  NOTES_COUNTS?: Record<string, number>;
  /** Pre-computed derived fields per check (available in slim mode) */
  CHECKS_META?: Record<string, CheckMeta>;
  __warnings?: string[];
}

/** Pre-computed fields for each check — avoids client-side event processing */
export interface CheckMeta {
  status: CheckStatus;
  balance: number;
  totalPaid: number;
  holdCount: number;
  returnCount: number;
  nextDeposit: string | null;
  reason: string | null;
  paymentDetails: string | null;
}

// ─── Supabase Database shape (used by createClient<Database>) ─────────────────

export interface Database {
  public: {
    Tables: {
      checks:       { Row: CheckRow;       Insert: Omit<CheckRow, 'created_at'>;       Update: Partial<CheckRow>;       };
      events:       { Row: EventRow;       Insert: Omit<EventRow, 'recorded_at'>;      Update: Partial<EventRow>;       };
      clients:      { Row: ClientRow;      Insert: ClientRow;                          Update: Partial<ClientRow>;      };
      branches:     { Row: BranchRow;      Insert: BranchRow;                          Update: Partial<BranchRow>;       };
      subsidiaries: { Row: SubsidiaryRow;  Insert: SubsidiaryRow;                      Update: Partial<SubsidiaryRow>;  };
      ae_list:      { Row: AeRow;          Insert: AeRow;                              Update: Partial<AeRow>;          };
      banks:        { Row: BankRow;        Insert: BankRow;                            Update: Partial<BankRow>;        };
      check_notes:  { Row: CheckNoteRow;   Insert: Omit<CheckNoteRow, 'created_at'>;  Update: Partial<CheckNoteRow>;   };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
