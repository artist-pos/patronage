-- Migration 038: Inquiry thread system messages + conversation tracking

-- System message flag + source tracking on messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system_message boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS source_action text DEFAULT NULL; -- 'profile_enquiry' | 'artwork_enquiry'

-- Enquiry metadata on conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS initiated_via_enquiry boolean NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source_action text DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source_work_id uuid REFERENCES artworks(id) ON DELETE SET NULL;
