-- Migration 020: Add 'owner' role
-- Combines artist profile + full admin access.
-- Assigned manually in Supabase; never exposed as a selectable option in the UI.
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'owner';
