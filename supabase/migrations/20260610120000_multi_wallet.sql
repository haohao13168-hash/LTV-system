-- ============================================================
-- Multi-wallet refactor: BCB + V12MY + future wallets
-- ============================================================
-- Each wallet (BCB, V12MY, ...) has its OWN view of the same 6 brand
-- names (BCB, BVBX, TTBET, X44, WTC, A6STAR), with different upline IDs
-- and completely independent data. Adding a `wallet` column lets us
-- store all wallets' data in the same tables.
--
-- BCB's existing rows keep wallet='BCB'. V12MY adds 6 new rows.
-- ============================================================

-- ─── bcb_platforms → multi-wallet ───────────────────────────
ALTER TABLE bcb_platforms ADD COLUMN IF NOT EXISTS wallet TEXT NOT NULL DEFAULT 'BCB';

-- Old unique key was on name alone; switch to (wallet, name)
ALTER TABLE bcb_platforms DROP CONSTRAINT IF EXISTS bcb_platforms_name_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bcb_platforms_wallet_name_key'
  ) THEN
    ALTER TABLE bcb_platforms ADD CONSTRAINT bcb_platforms_wallet_name_key UNIQUE (wallet, name);
  END IF;
END $$;

-- ─── bcb_lifetime_snapshots → multi-wallet ──────────────────
ALTER TABLE bcb_lifetime_snapshots ADD COLUMN IF NOT EXISTS wallet TEXT NOT NULL DEFAULT 'BCB';

-- Old PK was (date, platform_name); switch to (wallet, date, platform_name)
ALTER TABLE bcb_lifetime_snapshots DROP CONSTRAINT IF EXISTS bcb_lifetime_snapshots_pkey;
ALTER TABLE bcb_lifetime_snapshots ADD PRIMARY KEY (wallet, date, platform_name);

-- ─── bcb_sync_log → multi-wallet ────────────────────────────
ALTER TABLE bcb_sync_log ADD COLUMN IF NOT EXISTS wallet TEXT NOT NULL DEFAULT 'BCB';

-- ─── Seed V12MY's 6 sub-platforms ───────────────────────────
-- V12MY's wallet shows BCB, BVBX, TTBET, X44, WTC, A6STAR brands —
-- but with V12MY's own upline IDs and start dates (different from BCB's view)
INSERT INTO bcb_platforms (wallet, name, upline_code, start_date, display_order, total_downline, depositing_members, total_deposit, total_withdraw)
VALUES
  ('V12MY', 'BCB',    '2558A1812', '2024-11-23', 1, 0, 0, 0, 0),
  ('V12MY', 'BVBX',   '28A216A97', '2025-03-02', 2, 0, 0, 0, 0),
  ('V12MY', 'TTBET',  '3A1A87070', '2025-08-28', 3, 0, 0, 0, 0),
  ('V12MY', 'X44',    '283206057', '2025-02-26', 4, 0, 0, 0, 0),
  ('V12MY', 'WTC',    '351830255', '2025-09-30', 5, 0, 0, 0, 0),
  ('V12MY', 'A6STAR', '390086019', '2026-02-02', 6, 0, 0, 0, 0)
ON CONFLICT (wallet, name) DO NOTHING;

-- ─── Link V12MY company to its wallet ───────────────────────
UPDATE companies SET wallet_source = 'V12MY_TOTAL' WHERE name = 'V12MY';
