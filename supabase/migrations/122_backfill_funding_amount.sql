-- Backfill funding_amount from funding_range text for rows where funding_amount is null.
-- Extracts the largest integer found in the text (handles "€23,000 EUR", "$1,700 – $7,650", etc.)
-- Run once; safe to re-run (only touches rows where funding_amount IS NULL).

UPDATE opportunities
SET funding_amount = (
  SELECT MAX(n::integer)
  FROM regexp_matches(funding_range, '(\d[\d,]*)', 'g') AS m(raw)
  CROSS JOIN LATERAL (
    SELECT regexp_replace(raw[1], ',', '', 'g') AS n
  ) AS cleaned
  WHERE n ~ '^\d+$'
    AND n::integer > 0
)
WHERE funding_amount IS NULL
  AND funding_range IS NOT NULL
  AND funding_range != '';
