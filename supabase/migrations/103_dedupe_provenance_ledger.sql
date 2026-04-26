-- ============================================================
-- Migration 103: Dedupe artwork_provenance_ledger and lock down
-- the schema so the same artwork can never have two 'created'
-- or two 'transferred' entries (a self-healing read in the app
-- raced with itself and produced ~25 duplicates per work).
-- 'resold' is intentionally not constrained — a work can be
-- resold multiple times.
-- ============================================================

-- Keep the oldest entry per (artwork_id, entry_type) for the two
-- single-occurrence types. Newer duplicates are removed.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY artwork_id, entry_type
           ORDER BY transferred_at ASC, id ASC
         ) AS rn
    FROM artwork_provenance_ledger
   WHERE entry_type IN ('created', 'transferred')
)
DELETE FROM artwork_provenance_ledger
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevent the duplicate from ever being re-introduced.
CREATE UNIQUE INDEX IF NOT EXISTS apl_unique_per_type_per_artwork
  ON artwork_provenance_ledger (artwork_id, entry_type)
  WHERE entry_type IN ('created', 'transferred');
