-- ============================================================
-- ES Print Media Inc. Portal — Machine Monitoring Module Schema
-- Target: AWS RDS PostgreSQL / On-Prem PostgreSQL
--
-- Tables live in the dedicated schema `machine_monitoring`.
-- ============================================================

create extension if not exists "pgcrypto";

create schema if not exists machine_monitoring;
set search_path to machine_monitoring, public;

-- ─── LOOKUP TABLES ───────────────────────────────────────────
create table if not exists branches (
  id   serial primary key,
  code text not null unique
);

create table if not exists aes (
  id   serial primary key,
  code text not null unique
);

create table if not exists brands (
  id   serial primary key,
  name text not null unique
);

create table if not exists models (
  id   serial primary key,
  name text not null unique
);

-- Seed default lookups
insert into branches (code) values ('CAVITE'), ('ISABELA'), ('MLA'), ('PANG')
  on conflict (code) do nothing;
insert into aes (code) values ('DF'), ('JVE')
  on conflict (code) do nothing;

-- ─── MACHINES (Physical Inventory Units) ──────────────────────
create table if not exists machines (
  id                uuid primary key default gen_random_uuid(),
  serial_no         text,
  po_no             text,
  brand             text,
  model             text not null,
  branch            text,
  status            text not null default 'In Stock',
  client_name       text,
  client_code       text,
  location          text,
  ae                text,
  reservation_date  date,
  delivery_date     date,
  dispatch_date     date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_mm_machines_status on machines(status);
create index if not exists idx_mm_machines_brand  on machines(brand);
create index if not exists idx_mm_machines_model  on machines(model);
create index if not exists idx_mm_machines_branch on machines(branch);
create index if not exists idx_mm_machines_ae     on machines(ae);

-- ─── MACHINE HISTORY ──────────────────────────────────────────
create table if not exists machine_history (
  id         uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  event      text not null,
  actor      text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mm_history_machine on machine_history(machine_id);

-- ─── TBA LIST (Pending Reservations) ──────────────────────────
create table if not exists tba_list (
  id               uuid primary key default gen_random_uuid(),
  brand            text,
  model            text not null,
  client_name      text,
  client_code      text,
  location         text,
  ae               text,
  reservation_date date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_mm_tba_brand_model on tba_list(brand, model);

-- ─── REORDER POINTS ──────────────────────────────────────────
create table if not exists reorder_points (
  id        serial primary key,
  brand     text not null,
  model     text not null,
  quantity  int not null default 0,
  unique(brand, model)
);
