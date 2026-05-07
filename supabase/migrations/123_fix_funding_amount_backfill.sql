-- Reset and redo the funding_amount backfill with tighter rules.
-- Previous version picked the MAX number from funding_range text, which grabbed years
-- (2025, 2026) and other non-monetary numbers, inflating the total.
--
-- New rules:
--   1. Only consider numbers >= 200 (avoids counts like "3 recipients", "5 artists")
--   2. Only consider numbers < 2000000 (avoids runaway parsing errors)
--   3. Exclude anything that looks like a year (1900–2099)
--   4. Pick the MAX of what remains (upper bound of a range is more representative)

-- Step 1: clear values set by the previous backfill (funding_range was null before migration 122)
UPDATE opportunities
SET funding_amount = NULL
WHERE funding_range IS NOT NULL;

-- Step 2: re-populate with filtered values
UPDATE opportunities
SET funding_amount = (
  SELECT MAX(n::integer)
  FROM regexp_matches(funding_range, '(\d[\d,]*)', 'g') AS m(raw)
  CROSS JOIN LATERAL (
    SELECT regexp_replace(raw[1], ',', '', 'g') AS n
  ) AS cleaned
  WHERE n ~ '^\d+$'
    AND n::integer >= 200
    AND n::integer < 2000000
    AND n::integer NOT BETWEEN 1900 AND 2099  -- exclude years
)
WHERE funding_amount IS NULL
  AND funding_range IS NOT NULL
  AND funding_range != '';
