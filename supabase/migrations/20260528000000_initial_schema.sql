-- ============================================================
-- LTV system — initial schema
-- ============================================================
-- Tables:
--   companies       — marketing companies the user tracks
--   daily_entries   — per-company daily metrics (members, deposit, withdraw, net)
--   users           — login users (admin / agent / viewer)
--
-- Note: RLS is disabled for prototype. Anyone with the anon key can
-- read/write everything. Before going to production, enable RLS and
-- write policies (especially for the users table — passwords plain text).
-- ============================================================

-- ─── companies ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  color_id      text        NOT NULL DEFAULT 'lightCyan',
  custom_letter text        DEFAULT '',
  status        text        NOT NULL DEFAULT 'active',
  start_on      date        NOT NULL,
  inserted_at   timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- ─── daily_entries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_entries (
  id          text        PRIMARY KEY,
  company_id  text        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  members     integer     NOT NULL DEFAULT 0,
  deposit     integer     NOT NULL DEFAULT 0,
  withdraw    integer     NOT NULL DEFAULT 0,
  net         integer     NOT NULL DEFAULT 0,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_entries_company_date_idx
  ON daily_entries (company_id, date);

ALTER TABLE daily_entries DISABLE ROW LEVEL SECURITY;

-- ─── users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          text        PRIMARY KEY,
  username    text        UNIQUE NOT NULL,
  password    text        NOT NULL,
  name        text        NOT NULL,
  role        text        NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('admin', 'agent', 'viewer')),
  inserted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ─── seed: default admin user ───────────────────────────────
-- ⚠️  SECURITY WARNING ⚠️
-- This creates a default admin/admin login so the app works out of the box.
-- BEFORE DEPLOYING THIS APP PUBLICLY:
--   1. Sign in with admin/admin
--   2. Go to Users page → edit Administrator → change the password
--   3. (Recommended) Enable Row Level Security on these tables and add policies
--
-- Passwords are stored in plain text in this prototype — fine for internal/demo
-- use only. For production, switch to Supabase Auth (email + hashed passwords).
INSERT INTO users (id, username, password, name, role) VALUES
  ('u_admin', 'admin', 'admin', 'Administrator', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ─── seed: 5 sample companies ───────────────────────────────
INSERT INTO companies (id, name, color_id, custom_letter, status, start_on) VALUES
  ('c1', 'Acme Marketing',  'lightCyan', '', 'active', '2025-08-12'),
  ('c2', 'BlueOcean Media', 'deepCyan',  '', 'active', '2025-09-03'),
  ('c3', 'Nova Digital',    'lavender',  '', 'active', '2025-06-21'),
  ('c4', 'Pixel Reach',     'pink',      '', 'paused', '2025-10-15'),
  ('c5', 'Skyline Ads',     'gold',      '', 'active', '2025-07-08')
ON CONFLICT (id) DO NOTHING;
