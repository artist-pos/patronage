-- =============================================================
-- Patronage — Migration 005: Extended Opportunity Fields
-- Run in: Supabase SQL Editor
-- =============================================================

alter table opportunities
  add column if not exists funding_amount    integer,
  add column if not exists featured_image_url text,
  add column if not exists grant_type        text,
  add column if not exists recipients_count  integer;
