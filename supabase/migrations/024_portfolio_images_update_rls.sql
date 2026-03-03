-- Migration 024: Add UPDATE RLS policies for portfolio_images
-- Previously there were no UPDATE policies, causing all updates to fail silently.

-- Creator can update their own work (covers hide_from_archive, hide_price, etc.)
CREATE POLICY "portfolio_images_update_creator"
  ON portfolio_images FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Current owner can update their collection visibility flag
CREATE POLICY "portfolio_images_update_current_owner"
  ON portfolio_images FOR UPDATE
  USING (auth.uid() = current_owner_id)
  WITH CHECK (auth.uid() = current_owner_id);

-- Security-definer helper: check for a pending transfer request for a work
-- Uses SECURITY DEFINER to bypass RLS on messages (avoids potential recursion)
CREATE OR REPLACE FUNCTION has_pending_transfer(work_uuid uuid, buyer_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.work_id = work_uuid
      AND m.message_type = 'transfer_request'
      AND m.sender_id != buyer_uuid
      AND (c.participant_a = buyer_uuid OR c.participant_b = buyer_uuid)
  );
$$;

-- Buyer can accept a pending transfer:
-- USING:  work must be available, caller is not the creator,
--         and a transfer_request message exists in a shared conversation
-- WITH CHECK: caller becomes the new owner and work is marked unavailable
CREATE POLICY "portfolio_images_accept_transfer"
  ON portfolio_images FOR UPDATE
  USING (
    is_available = true
    AND auth.uid() != creator_id
    AND has_pending_transfer(id, auth.uid())
  )
  WITH CHECK (
    current_owner_id = auth.uid()
    AND is_available = false
  );
