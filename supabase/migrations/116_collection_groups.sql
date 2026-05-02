-- Named collection groups: each holder can have multiple named groups,
-- each with its own embed. Works are assigned to a group via collection_membership.group_id.

CREATE TABLE collection_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE collection_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Holders manage own groups" ON collection_groups
  FOR ALL USING (holder_id = auth.uid()) WITH CHECK (holder_id = auth.uid());

CREATE INDEX ON collection_groups (holder_id, position);

ALTER TABLE collection_membership
  ADD COLUMN group_id uuid REFERENCES collection_groups(id) ON DELETE SET NULL;

CREATE INDEX ON collection_membership (group_id);
