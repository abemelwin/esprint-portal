-- ============================================================
-- Sales Portal — schema alignment with the ORIGINAL Vue app
-- Source of truth: Sales Portal/supabase/migrations/*
--
-- Brings sales_portal.machines up to the orig's full column set and
-- REPLACES the placeholder quotes/quote_items tables (built by an earlier
-- scaffold) with the orig's quotes + quote sub-tables structure.
--
-- SAFE: the sales_portal.* tables have no production data yet. We drop and
-- recreate the quote tables to match the source exactly.
-- ============================================================

set search_path to sales_portal, public;

-- ─── MACHINES: add every catalog field the orig has ───────────
alter table machines add column if not exists has_trade_in              boolean not null default false;
alter table machines add column if not exists has_printhead             boolean not null default false;
alter table machines add column if not exists has_laser_tube            boolean not null default false;
alter table machines add column if not exists exclude_software_concerns boolean default true;
alter table machines add column if not exists service_fee               numeric(12,2) default 0;
alter table machines add column if not exists default_months            integer default 12;
alter table machines add column if not exists availability              text;
alter table machines add column if not exists image_key                 text;
-- printhead_warranty in orig defaults to '0 mo.' (text, free-form)
alter table machines alter column printhead_warranty set default '0 mo.';

-- ─── QUOTES: replace placeholder with the orig structure ──────
-- Old quote_items depended on the old quotes table; drop both first.
drop table if exists quote_items cascade;
drop table if exists quote_term_options cascade;
drop table if exists quote_trade_ins cascade;
drop table if exists quote_consumable_prices cascade;
drop table if exists quotes cascade;

create table quotes (
  id                      uuid primary key default gen_random_uuid(),
  -- portal auth is Cognito; store the creator's email + (optional) portal_users id
  user_id                 uuid references public.portal_users(id) on delete set null,
  user_email              text not null,
  machine_id              uuid references machines(id) on delete set null,

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

  -- toggleable package items (JSONB arrays of ToggleableItem)
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
create index if not exists idx_sp_quotes_user_email on quotes(user_email);
create index if not exists idx_sp_quotes_created on quotes(created_at desc);

create table quote_term_options (
  id                   uuid primary key default gen_random_uuid(),
  quote_id             uuid not null references quotes(id) on delete cascade,
  down_payment         numeric(12,2) not null default 0 check (down_payment >= 0),
  months               int not null check (months between 1 and 60),
  monthly_amortization numeric(12,2),
  sort_order           int not null default 0
);

create table quote_trade_ins (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  description text not null,
  value       numeric(12,2) not null default 0 check (value >= 0),
  sort_order  int not null default 0 check (sort_order between 0 and 2)
);

create table quote_consumable_prices (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references quotes(id) on delete cascade,
  consumable_id uuid not null references machine_consumables(id),
  custom_price  numeric(12,2) not null default 0 check (custom_price >= 0)
);

-- ─── PRODUCT INFO LINKS: match orig default document_type ─────
alter table product_info_links alter column document_type set default 'other';
