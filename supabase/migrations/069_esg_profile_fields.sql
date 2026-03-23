-- Migration 069: ESG profile fields for demographic reporting
-- city (required on form, nullable at DB for backfill), year_of_birth (opt-in), identity_tags (opt-in)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year_of_birth integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_tags text[] DEFAULT '{}';
