-- Migration 046: Add missing opportunity types to opp_type_enum
-- These types are used in the submission form but were never added to the enum,
-- causing approveSubmission to fail with an invalid enum value error.

ALTER TYPE opp_type_enum ADD VALUE IF NOT EXISTS 'Job / Employment';
ALTER TYPE opp_type_enum ADD VALUE IF NOT EXISTS 'Studio / Space';
ALTER TYPE opp_type_enum ADD VALUE IF NOT EXISTS 'Public Art';
