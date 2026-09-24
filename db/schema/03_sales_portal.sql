-- ============================================================
-- ES Print Media Inc. Portal — Sales Portal Module Schema
-- Target: AWS RDS PostgreSQL / On-Prem PostgreSQL
--
-- Tables live in the dedicated schema `sales_portal`.
-- ============================================================

create extension if not exists "pgcrypto";

create schema if not exists sales_portal;
set search_path to sales_portal, public;

-- ─── MACHINES (Catalog specifications and pricing) ────────────
create table if not exists machines (
  id                      uuid primary key default gen_random_uuid(),
  brand                   text not null,
  model                   text not null,
  sub_model               text,
  unit_condition          text not null default 'Brand New',
  letterhead              text not null default 'ES Print Media Inc.',
  srp                     numeric(14,2) not null default 0,
  lbp                     numeric(14,2) not null default 0,
  cash_price              numeric(14,2) not null default 0,
  machine_warranty_months int not null default 12,
  printhead_warranty      text not null default '0',
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists idx_sp_machines_unique on machines (brand, model, coalesce(sub_model, ''));
create index if not exists idx_sp_machines_brand on machines(brand);

-- ─── MACHINE FEATURES ─────────────────────────────────────────
create table if not exists machine_features (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

-- ─── MACHINE CONSUMABLES ──────────────────────────────────────
create table if not exists machine_consumables (
  id                  uuid primary key default gen_random_uuid(),
  machine_id          uuid not null references machines(id) on delete cascade,
  item_name           text not null,
  package_description text,
  default_price       numeric(12,2) not null default 0,
  sort_order          int not null default 0
);

-- ─── MACHINE INCLUSIONS ───────────────────────────────────────
create table if not exists machine_inclusions (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

-- ─── MACHINE EXCLUSIONS ───────────────────────────────────────
create table if not exists machine_exclusions (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

-- ─── MACHINE ADDONS ───────────────────────────────────────────
create table if not exists machine_addons (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

-- ─── PRODUCT INFO LINKS ───────────────────────────────────────
create table if not exists product_info_links (
  id            uuid primary key default gen_random_uuid(),
  machine_id    uuid not null references machines(id) on delete cascade,
  display_name  text not null,
  url           text not null,
  document_type text not null default 'brochure',
  created_at    timestamptz not null default now()
);

-- ─── QUOTES ───────────────────────────────────────────────────
create table if not exists quotes (
  id                  uuid primary key default gen_random_uuid(),
  quote_number        text not null unique,
  user_id             uuid references public.portal_users(id) on delete set null,
  user_email          text not null,
  client_name         text not null,
  company_name        text,
  contact_number      text,
  email               text,
  address             text,
  deal_type           text not null default 'Cash',
  letterhead          text not null default 'ES Print Media Inc.',
  term_months         int not null default 0,
  down_payment_pct    numeric(5,2) not null default 0,
  interest_rate_pct   numeric(5,2) not null default 0,
  total_amount        numeric(14,2) not null default 0,
  monthly_payment     numeric(14,2) not null default 0,
  signatory_name      text,
  signatory_title     text,
  notes               text,
  status              text not null default 'Draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── QUOTE ITEMS ──────────────────────────────────────────────
create table if not exists quote_items (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references quotes(id) on delete cascade,
  machine_id     uuid references machines(id) on delete set null,
  machine_name   text not null,
  unit_price     numeric(14,2) not null default 0,
  quantity       int not null default 1,
  total_price    numeric(14,2) not null default 0,
  details        jsonb default '{}'
);
