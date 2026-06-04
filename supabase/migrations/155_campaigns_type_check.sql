-- Migration 155: Expand campaigns.campaign_type check constraint
-- Adds market_stall and pop_up to match the artist self-serve form options.

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_campaign_type_check
  CHECK (campaign_type IN (
    'hoarding', 'billboard', 'truck_curtain', 'packaging',
    'art_fair', 'exhibition', 'other',
    'market_stall', 'pop_up'
  ));
