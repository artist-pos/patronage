-- Migration 022: Fix infinite recursion in messages INSERT policy
-- The previous policy used EXISTS (SELECT 1 FROM messages ...) inside a policy
-- ON messages, which causes Postgres to recurse infinitely.
-- Fix: extract the check into a SECURITY DEFINER function that bypasses RLS.

CREATE OR REPLACE FUNCTION has_prior_message(conv_id uuid, exclude_sender uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM messages
    WHERE conversation_id = conv_id
      AND sender_id != exclude_sender
  );
$$;

-- Recreate the insert policy using the bypass function
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;

CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Sender must be the authenticated user
    auth.uid() = sender_id
    -- Sender must be a participant in the conversation
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
    -- Role gate: non-artists can always send; artists can only reply
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) != 'artist'
      OR
      has_prior_message(conversation_id, auth.uid())
    )
  );
