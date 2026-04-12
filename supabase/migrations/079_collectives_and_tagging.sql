-- Collectives: standalone group entities (not a profiles row)
CREATE TABLE IF NOT EXISTS public.collectives (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL,
  description text,
  created_by  uuid    REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collectives_created_by ON collectives(created_by);

ALTER TABLE collectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view collectives"
  ON collectives FOR SELECT USING (true);

CREATE POLICY "Owners can manage their collectives"
  ON collectives FOR ALL
  USING (created_by = auth.uid());

-- Collective membership
CREATE TABLE IF NOT EXISTS public.collective_members (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  collective_id uuid    REFERENCES collectives(id) ON DELETE CASCADE NOT NULL,
  user_id       uuid    REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role          text    NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at     timestamptz DEFAULT now(),
  UNIQUE(collective_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collective_members_user ON collective_members(user_id);
CREATE INDEX IF NOT EXISTS idx_collective_members_collective ON collective_members(collective_id);

ALTER TABLE collective_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their collective memberships"
  ON collective_members FOR SELECT
  USING (user_id = auth.uid() OR collective_id IN (
    SELECT collective_id FROM collective_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage collective members"
  ON collective_members FOR ALL
  USING (
    collective_id IN (
      SELECT collective_id FROM collective_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow self-insert on join (for create flow where creator adds themselves)
CREATE POLICY "Users can join collectives"
  ON collective_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Artist tagging on portfolio works
ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS collaborator_ids uuid[] DEFAULT '{}';

-- Artist tagging on studio updates
ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS collaborator_ids uuid[] DEFAULT '{}';
