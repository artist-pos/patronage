-- Add tier_type to support_tiers for clearer categorisation in the UI
ALTER TABLE support_tiers
  ADD COLUMN IF NOT EXISTS tier_type text
    CHECK (tier_type IN ('one_off', 'recurring', 'service', 'project'));
