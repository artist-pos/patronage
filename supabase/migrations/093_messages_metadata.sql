-- Tag notification autoDM support
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;
