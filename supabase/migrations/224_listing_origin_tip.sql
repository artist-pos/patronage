-- 224 — Community tips get their own origin
--
-- Tips were stored as origin 'submission' with organiser 'Community Tip', so
-- nothing could tell them apart from a real organisation's submission once an
-- admin had corrected the organiser. Like scraped and admin-made listings, a tip
-- has no organisation behind it yet, so it needs the claim outreach details
-- (who to email, their name, how they take applications) before it goes live.
--
-- Run manually in the Supabase SQL Editor BEFORE deploying the code that writes
-- origin = 'tip', or tip inserts will fail the check constraint.

alter table public.opportunities
  drop constraint if exists opportunities_origin_check;

alter table public.opportunities
  add constraint opportunities_origin_check
    check (origin in ('scraper', 'submission', 'admin', 'tip'));

-- Backfill: tips never have an owner and were saved under this organiser name.
update public.opportunities
set origin = 'tip'
where origin = 'submission'
  and profile_id is null
  and organiser = 'Community Tip';

comment on column public.opportunities.origin is
  'scraper = found by the scraper (Scraper Queue); submission = sent in by an organisation (Submissions); tip = community tip (Submissions); admin = created or submitted by an admin (Submissions). Everything except submission needs claim outreach details before approval.';
