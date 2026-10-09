-- Roster notifications: an organisation inviting/removing an artist, and the
-- artist accepting/declining/leaving. Surfaced in the header bell.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'sale', 'support', 'transfer_request', 'transfer_accepted', 'note',
    'roster_invite', 'roster_accepted', 'roster_declined', 'roster_left', 'roster_removed'
  ));
