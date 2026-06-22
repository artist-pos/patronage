-- Allow 'note' notifications — fired when someone leaves a note on a studio update.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('sale', 'support', 'transfer_request', 'transfer_accepted', 'note'));
