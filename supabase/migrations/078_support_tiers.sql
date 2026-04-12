CREATE TABLE IF NOT EXISTS public.support_tiers (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid    REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title       text    NOT NULL,
  price       numeric NOT NULL,
  description text,
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tiers_profile ON support_tiers(profile_id, sort_order);

ALTER TABLE support_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active support tiers"
  ON support_tiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Owners can manage their own tiers"
  ON support_tiers FOR ALL
  USING (profile_id = auth.uid());

-- Intent capture table
CREATE TABLE IF NOT EXISTS public.support_intents (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id     uuid    REFERENCES support_tiers(id) ON DELETE CASCADE NOT NULL,
  email       text    NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_intents_tier ON support_intents(tier_id);

ALTER TABLE support_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register support intent"
  ON support_intents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Tier owners can read their intents"
  ON support_intents FOR SELECT
  USING (
    tier_id IN (
      SELECT id FROM support_tiers WHERE profile_id = auth.uid()
    )
  );
