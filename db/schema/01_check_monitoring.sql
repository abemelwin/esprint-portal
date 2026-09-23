-- ============================================================
-- ES Print Media Inc. Portal — Check Monitoring Module Schema
-- Target: AWS RDS PostgreSQL (pure Postgres, no Supabase)
--
-- Ported from esprint-check-monitoring/lib/schema.sql +
-- staging-setup.sql + migrations, with these changes for AWS:
--   - Removed Supabase RLS policies (auth is enforced in app code
--     via Cognito + rbac.ts)
--   - Removed auth.users FK dependency (users table is standalone,
--     linked to Cognito 'sub' string)
--   - Tables live in a shared portal database. Check Monitoring
--     tables use the "cm_" domain grouping via schema `checks`.
--
-- Run order: this file first (creates the `checks` schema).
-- ============================================================

create extension if not exists "pgcrypto";

-- Dedicated schema keeps this module's tables grouped and avoids
-- name clashes with future modules (hris_, machines_, etc.)
create schema if not exists check_monitoring;
set search_path to check_monitoring, public;

-- ─── BRANCHES ────────────────────────────────────────────────
create table if not exists branches (
  id          text primary key,
  name        text not null,
  subsidiary  text
);

-- ─── SUBSIDIARIES ────────────────────────────────────────────
create table if not exists subsidiaries (
  name text primary key
);

-- ─── AE_LIST ─────────────────────────────────────────────────
create table if not exists ae_list (
  name text primary key
);

-- ─── BANKS ───────────────────────────────────────────────────
create table if not exists banks (
  code text primary key,
  name text not null
);

-- ─── CLIENTS ─────────────────────────────────────────────────
create table if not exists clients (
  code      text primary key,
  name      text not null,
  branch_id text references branches(id) on delete set null,
  ae        text
);

-- ─── CHECKS ──────────────────────────────────────────────────
create table if not exists checks (
  id                  uuid primary key default gen_random_uuid(),
  client_code         text not null references clients(code) on delete restrict,
  branch_id           text references branches(id) on delete set null,
  subsidiary          text,
  ae                  text,
  bank                text,
  check_no            text not null,
  check_date          date,
  original_amount     numeric(15,2) not null default 0,
  payment_for         text,
  payment_description text,
  notes               text,
  final_status        text,
  blacklist_reason    text,
  replacement_of      uuid references checks(id) on delete set null,
  created_by          text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_checks_client_code  on checks(client_code);
create index if not exists idx_checks_branch_id     on checks(branch_id);
create index if not exists idx_checks_final_status  on checks(final_status);
create index if not exists idx_checks_created_at    on checks(created_at desc);
create unique index if not exists idx_checks_unique_branch_bank_no
  on checks(branch_id, lower(bank), lower(check_no))
  where bank is not null;

-- ─── EVENTS (append-only ledger — status/balance derived from this) ──
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  check_id    uuid not null references checks(id) on delete cascade,
  type        text not null,
  event_date  date,
  move_date   date,
  reason      text,
  method      text,
  reference   text,
  amount      numeric(15,2),
  notes       text,
  recorded_by text,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_events_check_id    on events(check_id);
create index if not exists idx_events_type         on events(type);
create index if not exists idx_events_event_date   on events(event_date);

-- ─── CHECK_NOTES ─────────────────────────────────────────────
create table if not exists check_notes (
  id              uuid primary key default gen_random_uuid(),
  check_id        uuid not null references checks(id) on delete cascade,
  content         text not null,
  created_by      text not null,
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists idx_check_notes_check_id on check_notes(check_id);

-- ─── DELETED_CHECKS (soft-delete archive) ────────────────────
create table if not exists deleted_checks (
  id               uuid primary key default gen_random_uuid(),
  check_id         text not null,
  check_snapshot   jsonb not null,
  events_snapshot  jsonb not null default '[]',
  deleted_by       text not null,
  deleted_by_name  text not null,
  deleted_at       timestamptz not null default now()
);
create index if not exists idx_deleted_checks_check_id  on deleted_checks(check_id);
create index if not exists idx_deleted_checks_deleted_by on deleted_checks(deleted_by);

-- ─── DELETE_REQUESTS (deletion approval workflow) ────────────
-- Columns aligned to production backup (requested_by_name, status, created_at)
create table if not exists delete_requests (
  id                uuid primary key default gen_random_uuid(),
  check_id          uuid references checks(id) on delete cascade,
  requested_by      text not null,
  requested_by_name text,
  status            text not null default 'pending',   -- pending | approved | rejected
  created_at        timestamptz not null default now(),
  reason            text not null default '',
  target_type       text not null default 'check',
  event_id          uuid
);

-- ─── PENALTY_RECORDS (standalone editable list — ₱500/move charges) ──
-- Independent of the checks ledger. Manually-entered rows.
create table if not exists penalty_records (
  id              text primary key,
  client          text not null,
  move_num        text,                       -- '1ST'..'10TH'
  check_no        text,
  check_date      date,
  amount          numeric(15,2) not null default 0,
  paid_charge     numeric(15,2) not null default 0,
  pending_charge  numeric(15,2) not null default 0,
  payment_details text
);
create index if not exists idx_penalty_client on penalty_records(client);

-- ─── BAD_ACCOUNT_LIST (standalone editable monitoring list) ──────────
create table if not exists bad_account_list (
  id          uuid primary key default gen_random_uuid(),
  ae          text,
  branch_id   text references branches(id) on delete set null,
  client_name text not null,
  status      text not null,                  -- BAD ACCOUNT | DEMAND LETTER | WITH OVERDUE BALANCE | WITH RECON | WITH LEGAL CASE | BLACKLIST
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_bad_account_created_at on bad_account_list(created_at desc);

-- ─── RECON_INTEREST (per-client interest amount for reconstruct) ─────
create table if not exists recon_interest (
  client_code     text primary key,
  interest_amount numeric(15,2) not null default 0,
  updated_by      text,
  updated_at      timestamptz not null default now()
);

-- ─── RECON_SCHEDULE (per-client payment schedule for reconstruct) ────
create table if not exists recon_schedule (
  id                   uuid primary key default gen_random_uuid(),
  client_code          text not null,
  schedule_date        date,
  monthly_amortization numeric(15,2),
  amount               numeric(15,2),
  payment_details      text,
  sort_order           integer not null default 0,
  event_id             uuid,
  check_id             uuid,
  created_at           timestamptz not null default now()
);
create index if not exists idx_recon_schedule_client on recon_schedule(client_code);
