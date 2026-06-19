-- Fix TTB company wallet binding
-- The previous migration assumed company name 'TTBET', but the actual
-- company is named 'TTB'. The wallet is still 'TTBET' (matches the API
-- endpoint and bcb_platforms.wallet column), only the display name differs.
UPDATE companies SET wallet_source = 'TTBET_TOTAL' WHERE name = 'TTB';
