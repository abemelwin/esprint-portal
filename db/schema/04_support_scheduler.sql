-- ============================================================
-- ES Print Media Inc. Portal — Support Scheduler Module
-- Target: AWS RDS PostgreSQL
-- ============================================================

CREATE SCHEMA IF NOT EXISTS scheduler;

-- 1. Scheduler Branches
CREATE TABLE IF NOT EXISTS scheduler.branches (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT DEFAULT ''
);

-- 2. Scheduler Staff
CREATE TABLE IF NOT EXISTS scheduler.staff (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL,
  home_branch_id TEXT REFERENCES scheduler.branches(id) ON DELETE SET NULL,
  hotline        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Scheduler Jobs
CREATE TABLE IF NOT EXISTS scheduler.jobs (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  jt_no       TEXT NOT NULL,
  staff_id    TEXT REFERENCES scheduler.staff(id) ON DELETE SET NULL,
  branch_id   TEXT REFERENCES scheduler.branches(id) ON DELETE SET NULL,
  customer    TEXT NOT NULL DEFAULT '',
  location    TEXT DEFAULT '',
  type        TEXT NOT NULL,
  type_other  TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  status_note TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Scheduler App Users / Approvals
CREATE TABLE IF NOT EXISTS scheduler.registration_approvals (
  id          TEXT PRIMARY KEY,
  auth_id     UUID,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'branch',
  branch_ids  TEXT[] DEFAULT '{}',
  can_edit    BOOLEAN DEFAULT FALSE,
  is_active   BOOLEAN DEFAULT TRUE,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
