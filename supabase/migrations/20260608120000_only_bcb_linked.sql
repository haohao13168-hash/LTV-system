-- Only BCB is linked to wallet data for now. The 6 other dashboard companies
-- (V12MY, BVBX, TTB, X44, WTC88, A6STAR) will be linked later, each to its
-- own separate wallet.
--
-- The 6 sub-platforms inside BCB's wallet (also named V12MY/BVBX/TTBET/X44/
-- WTC/A6STAR) live in the bcb_platforms table — that data is separate from the
-- dashboard companies above.

UPDATE companies
  SET wallet_source = NULL
  WHERE name IN ('V12MY', 'BVBX', 'TTB', 'X44', 'WTC88', 'A6STAR');

-- BCB keeps wallet_source = 'BCB_TOTAL'
