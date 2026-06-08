-- Add withdraw + net snapshot columns to bcb_platforms.
-- The droplet sync now pulls all completed WITHDRAW transactions, attributes
-- each to its upline (via the user→referrer map it already built), and writes
-- the per-platform total here.

ALTER TABLE bcb_platforms
  ADD COLUMN IF NOT EXISTS total_withdraw NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Also add to the sync log for visibility
ALTER TABLE bcb_sync_log
  ADD COLUMN IF NOT EXISTS total_withdraw NUMERIC(15, 2) NOT NULL DEFAULT 0;
