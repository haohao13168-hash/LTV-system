-- Link dashboard companies to BCB wallet platforms.
-- A company with a wallet_source pulls its stats live from bcb_platforms
-- instead of daily_entries.
--
-- wallet_source values:
--   'BCB_TOTAL'  → sum of all rows in bcb_platforms
--   'V12MY'      → bcb_platforms.name = 'V12MY'  (etc.)
--   NULL         → manual mode (uses daily_entries as before)

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS wallet_source TEXT;

-- Map the 7 existing dashboard companies to the wallet (user confirmed)
UPDATE companies SET wallet_source = 'BCB_TOTAL' WHERE name = 'BCB';
UPDATE companies SET wallet_source = 'V12MY'     WHERE name = 'V12MY';
UPDATE companies SET wallet_source = 'BVBX'      WHERE name = 'BVBX';
UPDATE companies SET wallet_source = 'TTBET'     WHERE name = 'TTB';
UPDATE companies SET wallet_source = 'X44'       WHERE name = 'X44';
UPDATE companies SET wallet_source = 'WTC'       WHERE name = 'WTC88';
UPDATE companies SET wallet_source = 'A6STAR'    WHERE name = 'A6STAR';
