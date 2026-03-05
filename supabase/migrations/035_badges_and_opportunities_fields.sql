-- Migration 035: Badge system + Enhanced opportunity fields + Application routing

-- Profiles: artist-inputted grants
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS received_grants text[] NOT NULL DEFAULT '{}';

-- Opportunities: transparency fields
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS entry_fee numeric DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS artist_payment_type text DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS travel_support boolean DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS travel_support_details text DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Opportunities: application routing
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS routing_type text NOT NULL DEFAULT 'external';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS show_badges_in_submission boolean NOT NULL DEFAULT true;

-- opportunity_submissions: partner form stores routing info before admin review
ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS routing_type text NOT NULL DEFAULT 'external';
ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]';
ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS show_badges_in_submission boolean NOT NULL DEFAULT true;
