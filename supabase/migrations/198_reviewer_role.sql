-- Migration 198: guest reviewer role
-- Run this ALONE in the Supabase SQL Editor, before 199. A new enum value cannot
-- be used in the same transaction that adds it.
--
-- A 'reviewer' is a light account created when an organisation invites someone to
-- review by email. They sign in with a magic link, no password or profile, and
-- are later offered a full account (artist, patron, or under the organisation).

ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'reviewer';
