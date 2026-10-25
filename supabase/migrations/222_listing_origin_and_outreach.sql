-- 222 — Where a listing came from, and who to contact about it
--
-- 1. origin: scraped listings and real submissions both sat at status 'pending',
--    so each showed up in both /admin/opportunities/queue and /admin/submissions.
--    The queue is for what the scraper found; Submissions is for what an
--    organisation (or an admin) sent in.
-- 2. Outreach details for aggregated listings: who to email, what to call them,
--    and what they use to take applications today. Entered once at approval,
--    reused by the claim CSV export, the invite panel and the daily claim cron.
--
-- Run manually in the Supabase SQL Editor. Run it BEFORE deploying the code that
-- reads these columns, or the queue and submissions pages will come up empty.

alter table public.opportunities
  add column if not exists origin text not null default 'submission'
    check (origin in ('scraper', 'submission', 'admin'));

-- Backfill: the scraper is the only thing that sets confidence / last_seen_at.
update public.opportunities
set origin = 'scraper'
where origin = 'submission'
  and (confidence is not null or last_seen_at is not null);

-- Admin-made unclaimed drafts.
update public.opportunities
set origin = 'admin'
where origin = 'submission'
  and status = 'draft_unclaimed';

create index if not exists opportunities_origin_status_idx
  on public.opportunities (origin, status);

comment on column public.opportunities.origin is
  'scraper = found by the scraper (Scraper Queue); submission = sent in by an organisation or tipster (Submissions); admin = created by an admin.';

alter table public.opportunities
  add column if not exists claim_contact_name text,
  add column if not exists claim_current_tool text;

comment on column public.opportunities.claim_contact_name is
  'Who at the organisation to address claim outreach to ("team" for a general inbox). Paired with claim_email.';
comment on column public.opportunities.claim_current_tool is
  'How the organisation takes applications today: website form, Google Form, Jotform, email, Submittable, etc.';
