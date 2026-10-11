-- Activation nudges: day-2 and day-7 emails that push new artists towards
-- Verified (bio, photo, three works). One row per profile per kind, written
-- only after a successful send, so a run that hits its daily budget simply
-- picks the rest up the next day.
CREATE TABLE IF NOT EXISTS activation_nudges (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('day2', 'day7')),
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, kind)
);

-- Service role only (the cron uses the admin client). RLS on with no policies
-- means no client can read or write it.
ALTER TABLE activation_nudges ENABLE ROW LEVEL SECURITY;
