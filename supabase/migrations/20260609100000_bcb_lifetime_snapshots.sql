-- ============================================================
-- BCB lifetime snapshots — one row per (date, platform), holding the
-- CUMULATIVE lifetime totals at end-of-day. Range queries become a pair
-- of lookups + subtraction:
--
--   range(from..to) = snapshot(to) - snapshot(from - 1)
--
-- Filled by a nightly cron (00:30 MY) + a one-off backfill that walks
-- back from today to each platform's start_date.
-- ============================================================

CREATE TABLE IF NOT EXISTS bcb_lifetime_snapshots (
  date               date         NOT NULL,
  platform_name      text         NOT NULL,
  depositing_members integer      NOT NULL DEFAULT 0,
  total_deposit      numeric(15, 2) NOT NULL DEFAULT 0,
  total_withdraw     numeric(15, 2) NOT NULL DEFAULT 0,
  total_downline     integer      NOT NULL DEFAULT 0,
  computed_at        timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (date, platform_name)
);

CREATE INDEX IF NOT EXISTS bcb_lifetime_snapshots_date_idx
  ON bcb_lifetime_snapshots (date DESC);

CREATE INDEX IF NOT EXISTS bcb_lifetime_snapshots_platform_idx
  ON bcb_lifetime_snapshots (platform_name, date DESC);

ALTER TABLE bcb_lifetime_snapshots DISABLE ROW LEVEL SECURITY;
