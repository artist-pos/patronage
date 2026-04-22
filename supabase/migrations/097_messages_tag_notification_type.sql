-- Add tag_notification to the messages message_type check constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text',
    'transfer_request',
    'transfer_accepted',
    'deletion_request',
    'deletion_accepted',
    'work_offer',
    'tag_notification'
  ));
