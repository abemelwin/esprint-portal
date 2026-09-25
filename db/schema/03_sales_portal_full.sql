-- ============================================================
-- ES Print Media Inc. Portal — Sales Portal Module
-- FULL schema creation + alignment with orig Vue app.
-- Target: AWS RDS PostgreSQL
--
-- All tables are schema-qualified (sales_portal.*) so this can
-- be run in a single pass regardless of search_path.
-- ============================================================

create schema if not exists sales_portal;

-- ─── MACHINES ─────────────────────────────────────────────────
create table if not exists sales_portal.machines (
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
  printhead_warranty      text not null default '0 mo.',
  is_active               boolean not null default true,
  -- catalog fields (from orig 20250101000015 + 024 + 025 migrations)
  has_trade_in              boolean not null default false,
  has_printhead             boolean not null default false,
  has_laser_tube            boolean not null default false,
  exclude_software_concerns boolean default true,
  service_fee               numeric(12,2) default 0,
  default_months            integer default 12,
  availability              text,
  image_key                 text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists idx_sp_machines_unique on sales_portal.machines (brand, model, coalesce(sub_model, ''));
create index if not exists idx_sp_machines_brand on sales_portal.machines(brand);

-- ─── MACHINE SUB-TABLES ───────────────────────────────────────
create table if not exists sales_portal.machine_features (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references sales_portal.machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

create table if not exists sales_portal.machine_consumables (
  id                  uuid primary key default gen_random_uuid(),
  machine_id          uuid not null references sales_portal.machines(id) on delete cascade,
  item_name           text not null,
  package_description text,
  default_price       numeric(12,2) not null default 0,
  sort_order          int not null default 0
);

create table if not exists sales_portal.machine_inclusions (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references sales_portal.machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

create table if not exists sales_portal.machine_exclusions (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references sales_portal.machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

create table if not exists sales_portal.machine_addons (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null references sales_portal.machines(id) on delete cascade,
  description text not null,
  sort_order  int not null default 0
);

-- ─── PRODUCT INFO LINKS ───────────────────────────────────────
create table if not exists sales_portal.product_info_links (
  id            uuid primary key default gen_random_uuid(),
  machine_id    uuid not null references sales_portal.machines(id) on delete cascade,
  display_name  text not null,
  url           text not null,
  document_type text not null default 'other',
  created_at    timestamptz not null default now()
);

-- ─── QUOTES (orig structure from migration 000006 + 000011) ───
create table if not exists sales_portal.quotes (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references public.portal_users(id) on delete set null,
  user_email              text not null,
  machine_id              uuid references sales_portal.machines(id) on delete set null,

  -- client info
  client_name             text,
  company                 text,
  address                 text,
  contact                 text,
  email                   text,
  quote_date              date,
  salutation              text,
  opening_line            text,

  -- deal + pricing
  deal_type               text check (deal_type in ('Standard Cash','Standard Terms','Trade-In Cash','Trade-In Terms')),
  contract_price          numeric(12,2),
  vat_inclusive           boolean not null default false,
  under_promo             boolean not null default false,
  promo_validity          text,
  unit_condition_override text,

  -- delivery / computer set
  include_delivery        boolean default false,
  include_computer_set    boolean default false,
  computer_set_spec       text,

  -- toggleable package items
  inclusion_toggles       jsonb,
  exclusion_toggles       jsonb,
  addon_toggles           jsonb,

  -- warranty
  warranty_company        text,
  warranty_supplier       text,

  -- collection terms
  availability            text,
  collection_payment      text,
  collection_downpayment  text,
  collection_amortization text,

  -- signatories
  ae_name                 text,
  client_conforme         text,
  noted_by_name           text,
  noted_by_role           text,

  letterhead              text default 'ES Print Media Inc.',
  freebies                jsonb default '[]'::jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_sp_quotes_user_email on sales_portal.quotes(user_email);
create index if not exists idx_sp_quotes_created    on sales_portal.quotes(created_at desc);

-- ─── QUOTE SUB-TABLES (migration 000007) ──────────────────────
create table if not exists sales_portal.quote_term_options (
  id                   uuid primary key default gen_random_uuid(),
  quote_id             uuid not null references sales_portal.quotes(id) on delete cascade,
  down_payment         numeric(12,2) not null default 0 check (down_payment >= 0),
  months               int not null check (months between 1 and 60),
  monthly_amortization numeric(12,2),
  sort_order           int not null default 0
);

create table if not exists sales_portal.quote_trade_ins (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references sales_portal.quotes(id) on delete cascade,
  description text not null,
  value       numeric(12,2) not null default 0 check (value >= 0),
  sort_order  int not null default 0 check (sort_order between 0 and 2)
);

create table if not exists sales_portal.quote_consumable_prices (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references sales_portal.quotes(id) on delete cascade,
  consumable_id uuid not null references sales_portal.machine_consumables(id),
  custom_price  numeric(12,2) not null default 0 check (custom_price >= 0)
);
