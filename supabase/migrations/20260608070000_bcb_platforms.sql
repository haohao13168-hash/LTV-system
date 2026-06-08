-- BCB Wallet API integration tables.
-- The droplet sync service writes here; the dashboard reads from here.

-- 1. The 6 BCB platforms (V12MY, BVBX, TTBET, X44, WTC, A6STAR).
--    One row per platform. Sync overwrites the snapshot fields.
CREATE TABLE IF NOT EXISTS bcb_platforms (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT        NOT NULL UNIQUE,
  upline_code         TEXT        NOT NULL,
  start_date          DATE,
  display_order       INT         NOT NULL DEFAULT 0,

  -- Snapshot fields — updated on every sync
  total_downline      INT         NOT NULL DEFAULT 0,
  depositing_members  INT         NOT NULL DEFAULT 0,
  total_deposit       NUMERIC(15, 2) NOT NULL DEFAULT 0,
  last_synced_at      TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bcb_platforms DISABLE ROW LEVEL SECURITY;

-- Seed the 6 platforms (with the upline codes the user gave us)
INSERT INTO bcb_platforms (name, upline_code, start_date, display_order) VALUES
  ('V12MY',  '2556138A7', '2024-11-22', 1),
  ('BVBX',   '28A228535', '2025-03-02', 2),
  ('TTBET',  '3A3087789', '2025-09-02', 3),
  ('X44',    '28335A236', '2025-02-27', 4),
  ('WTC',    '351836927', '2025-09-30', 5),
  ('A6STAR', '3900668AA', '2026-02-02', 6)
ON CONFLICT (name) DO NOTHING;

-- 2. Sync history — one row per sync attempt.
--    Dashboard reads the latest row to show "Last synced X ago" and status.
CREATE TABLE IF NOT EXISTS bcb_sync_log (
  id                        BIGSERIAL PRIMARY KEY,
  started_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at               TIMESTAMPTZ,
  status                    TEXT NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'success', 'error')),
  trigger_source            TEXT NOT NULL DEFAULT 'cron'
                            CHECK (trigger_source IN ('cron', 'manual', 'startup')),
  error_message             TEXT,
  duration_ms               INT,
  platforms_synced          INT NOT NULL DEFAULT 0,
  total_downline            INT NOT NULL DEFAULT 0,
  total_depositing_members  INT NOT NULL DEFAULT 0,
  total_deposit             NUMERIC(15, 2) NOT NULL DEFAULT 0
);

ALTER TABLE bcb_sync_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS bcb_sync_log_started_at_idx
  ON bcb_sync_log (started_at DESC);
