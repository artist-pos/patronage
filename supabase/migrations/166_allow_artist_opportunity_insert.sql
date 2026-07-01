-- 166: Allow artists to list opportunities
--
-- Migration 025 restricted the profile-owner INSERT policy to
-- ('patron', 'partner', 'owner'). The /partner listing wizard creates a draft
-- row first (status='draft', is_active=false, profile_id=auth.uid()), and none
-- of the existing INSERT policies permit that for an artist:
--   * insert_admin                     — not an admin
--   * insert_profile_owner (025)       — 'artist' not in the allowed roles
--   * insert_public_submission (064)   — requires profile_id IS NULL
--   * insert_authenticated_submission  — requires status='pending', not 'draft'
-- Result: "new row violates row-level security policy for table opportunities"
-- (a 500) whenever an artist opens the listing wizard.
--
-- Add 'artist' to the profile-owner INSERT policy so artists can create and
-- own opportunity drafts exactly like partners/patrons/owners. The UPDATE and
-- DELETE policies (025) and the SELECT-own policy (064) already gate on
-- profile_id alone, so the rest of the wizard works for artists once the draft
-- can be created.
--
-- auth.uid() is wrapped as (select auth.uid()) to preserve the InitPlan
-- optimisation applied in migration 161 (semantics-preserving).

DROP POLICY IF EXISTS "opportunities_insert_profile_owner" ON opportunities;

CREATE POLICY "opportunities_insert_profile_owner"
  ON opportunities FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = profile_id
    AND (SELECT role FROM profiles WHERE id = (select auth.uid()))
        IN ('artist', 'patron', 'partner', 'owner')
  );
