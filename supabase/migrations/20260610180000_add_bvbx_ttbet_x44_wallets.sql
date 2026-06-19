-- ============================================================
-- Add BVBX, TTBET, X44 wallets
-- ============================================================
-- Each wallet's 6 sub-platforms = the OTHER 6 brand names
-- (matching the pattern BCB/V12MY already use). User-supplied
-- "V12BETMY" maps to the canonical brand name "V12MY".
-- ============================================================

-- ─── BVBX wallet — 6 sub-platforms ──────────────────────────
INSERT INTO bcb_platforms (wallet, name, upline_code, start_date, display_order, total_downline, depositing_members, total_deposit, total_withdraw)
VALUES
  ('BVBX', 'BCB',    '11631816', '2025-03-03', 1, 0, 0, 0, 0),
  ('BVBX', 'V12MY',  '116318A3', '2025-03-03', 2, 0, 0, 0, 0),
  ('BVBX', 'TTBET',  '17081795', '2025-08-28', 3, 0, 0, 0, 0),
  ('BVBX', 'X44',    '11656789', '2025-03-04', 4, 0, 0, 0, 0),
  ('BVBX', 'WTC',    '80752A9',  '2024-10-31', 5, 0, 0, 0, 0),
  ('BVBX', 'A6STAR', '22266288', '2026-02-02', 6, 0, 0, 0, 0)
ON CONFLICT (wallet, name) DO NOTHING;

-- ─── TTBET wallet — 6 sub-platforms ─────────────────────────
INSERT INTO bcb_platforms (wallet, name, upline_code, start_date, display_order, total_downline, depositing_members, total_deposit, total_withdraw)
VALUES
  ('TTBET', 'BCB',    '3A1A85187', '2025-08-28', 1, 0, 0, 0, 0),
  ('TTBET', 'V12MY',  '3A1A85326', '2025-08-28', 2, 0, 0, 0, 0),
  ('TTBET', 'BVBX',   '3A1A85395', '2025-08-28', 3, 0, 0, 0, 0),
  ('TTBET', 'X44',    '3A1A85A73', '2025-08-28', 4, 0, 0, 0, 0),
  ('TTBET', 'WTC',    '351836519', '2025-09-30', 5, 0, 0, 0, 0),
  ('TTBET', 'A6STAR', '39006A027', '2026-02-02', 6, 0, 0, 0, 0)
ON CONFLICT (wallet, name) DO NOTHING;

-- ─── X44 wallet — 6 sub-platforms ───────────────────────────
INSERT INTO bcb_platforms (wallet, name, upline_code, start_date, display_order, total_downline, depositing_members, total_deposit, total_withdraw)
VALUES
  ('X44', 'BCB',    '282818AA7', '2025-02-25', 1, 0, 0, 0, 0),
  ('X44', 'V12MY',  '282817782', '2025-02-25', 2, 0, 0, 0, 0),
  ('X44', 'BVBX',   '28A912832', '2025-03-04', 3, 0, 0, 0, 0),
  ('X44', 'TTBET',  '3A1A88316', '2025-08-28', 4, 0, 0, 0, 0),
  ('X44', 'WTC',    '3518A1580', '2025-09-30', 5, 0, 0, 0, 0),
  ('X44', 'A6STAR', '390188A32', '2026-02-02', 6, 0, 0, 0, 0)
ON CONFLICT (wallet, name) DO NOTHING;

-- ─── Link companies to their wallets ────────────────────────
UPDATE companies SET wallet_source = 'BVBX_TOTAL'  WHERE name = 'BVBX';
UPDATE companies SET wallet_source = 'TTBET_TOTAL' WHERE name = 'TTBET';
UPDATE companies SET wallet_source = 'X44_TOTAL'   WHERE name = 'X44';
