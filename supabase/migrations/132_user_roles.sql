CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  granted_to_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('studio_manager', 'gallery_rep', 'estate_manager')),
  permissions jsonb DEFAULT '{}',
  granted_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, granted_to_user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Profile owner can manage their own grants
CREATE POLICY "user_roles_owner_manage" ON user_roles
  FOR ALL USING (profile_id = auth.uid());

-- Grantee can read their own grants (so they know what they have access to)
CREATE POLICY "user_roles_grantee_read" ON user_roles
  FOR SELECT USING (granted_to_user_id = auth.uid());
