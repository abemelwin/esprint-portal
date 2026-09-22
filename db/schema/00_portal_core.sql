-- ============================================================
-- ES Print Media Inc. Portal — Core (shared) Schema
-- Target: AWS RDS PostgreSQL
--
-- These tables are shared across ALL modules. They implement the
-- two-level RBAC:
--   portal_users     — one row per person (mirrors Cognito user)
--   module_access    — which modules a user can open + their role
--                      inside each module + module-admin flag
--
-- Run this BEFORE any module schema file.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── PORTAL USERS ────────────────────────────────────────────
-- Mirrors the Cognito user directory. `cognito_sub` is the Cognito
-- user id (the 'sub' claim). We keep a local copy so modules can FK
-- to a stable user id without calling Cognito on every query.
create table if not exists portal_users (
  id           uuid primary key default gen_random_uuid(),
  cognito_sub  text unique,               -- Cognito 'sub' (null in dev mode)
  email        text unique not null,
  full_name    text not null default '',
  portal_role  text not null default 'user',  -- 'super_admin' | 'user'
  is_active     boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_portal_users_email on portal_users(email);

-- ─── MODULE ACCESS ───────────────────────────────────────────
-- One row per (user, module). Defines whether the user can open a
-- module, their role inside it, and whether they can administer
-- other users' access within that module.
create table if not exists module_access (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references portal_users(id) on delete cascade,
  module          text not null,           -- 'checks' | 'hris' | 'machines' ...
  module_role     text not null,           -- module-specific role string
  is_module_admin boolean not null default false,
  branches        text[] not null default '{}',  -- branch scope (optional)
  aes             text[] not null default '{}',  -- AE-code scope (optional)
  granted_by      uuid references portal_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, module)
);
create index if not exists idx_module_access_user   on module_access(user_id);
create index if not exists idx_module_access_module on module_access(module);

-- ─── AUDIT LOG (optional but recommended) ────────────────────
-- Tracks access changes so you can see who granted what.
create table if not exists access_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action      text not null,       -- 'grant' | 'revoke' | 'change_role' ...
  target_email text not null,
  module      text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_access_audit_created on access_audit(created_at desc);
