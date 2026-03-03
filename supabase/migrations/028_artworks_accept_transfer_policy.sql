-- Migration 028: Add accept-transfer UPDATE policy to artworks table.
-- The has_pending_transfer() security-definer function was created in migration 024
-- and works generically against messages, so we can reuse it here.

CREATE POLICY "artworks_accept_transfer"
  ON artworks FOR UPDATE
  USING (
    is_available = true
    AND auth.uid() != creator_id
    AND has_pending_transfer(id, auth.uid())
  )
  WITH CHECK (
    current_owner_id = auth.uid()
    AND is_available = false
  );
