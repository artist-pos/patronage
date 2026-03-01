-- =============================================================
-- Patronage — Migration 003: Admin Policy Additions
-- Run in: Supabase SQL Editor
-- =============================================================

-- Allow admins to SELECT all opportunities (including inactive / expired)
-- (public policy already exists and filters to active + non-expired;
--  multiple SELECT policies are OR'd, so admins see the union = everything)
create policy "opportunities_select_admin"
  on opportunities for select
  using (is_admin());

-- Allow admins to hard-delete profiles
create policy "profiles_delete_admin"
  on profiles for delete
  using (is_admin());
