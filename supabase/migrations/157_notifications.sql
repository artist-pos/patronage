CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('sale', 'support', 'transfer_request', 'transfer_accepted')),
  title       text NOT NULL,
  body        text,
  link        text,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread  ON notifications (user_id, read);
CREATE INDEX notifications_user_created ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
