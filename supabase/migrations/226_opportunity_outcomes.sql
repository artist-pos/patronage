-- 226 — Outcome reports on opportunities
--
-- Artists say whether they applied and how it went. The public page shows
-- aggregate figures only, behind thresholds, so no one can be identified.
-- Structured answers, not reviews: complaints go to Patronage privately.
-- See docs/social-phase-1.md, feature 4. Run manually in the Supabase SQL
-- Editor BEFORE deploying the code.
--
-- Thresholds (enforced here, not in the app):
--   participation ("reported by N")           3+ reports
--   response figures ("N of M heard back")    5+ reports from people who applied
--   anonymous tips                            5+ reports, and admin-approved
--   any figure of 1 or 2                      returned as -1 ("a few")
--   rounds with recipients_count <= 2         participation only

create table if not exists public.opportunity_outcomes (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  applied        boolean not null,
  result         text check (result in ('selected', 'shortlisted', 'unsuccessful', 'no_response')),
  response_weeks integer check (response_weeks between 0 and 52),
  tip            text check (tip is null or char_length(tip) <= 280),
  -- Tips are public, so they wait for a quick admin check.
  tip_status     text not null default 'pending' check (tip_status in ('pending', 'approved', 'hidden')),
  private_note   text check (private_note is null or char_length(private_note) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (opportunity_id, user_id),
  -- Results only mean something from people who applied.
  check (applied or (result is null and response_weeks is null))
);

create index if not exists opportunity_outcomes_pending_tips_idx
  on public.opportunity_outcomes (created_at desc)
  where tip is not null and tip_status = 'pending';

-- tip_status is Patronage's to set (service role, from the admin page). For
-- everyone else: a new report's tip starts pending, an edit keeps the status
-- unless the tip text changed, and a changed tip goes back for review.
create or replace function public.opportunity_outcomes_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'UPDATE' then new.updated_at := now(); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.tip_status := 'pending';
  else
    new.updated_at := now();
    new.tip_status := case when new.tip is distinct from old.tip then 'pending' else old.tip_status end;
  end if;
  return new;
end;
$$;

drop trigger if exists opportunity_outcomes_guard on public.opportunity_outcomes;
create trigger opportunity_outcomes_guard
  before insert or update on public.opportunity_outcomes
  for each row execute function public.opportunity_outcomes_guard();

alter table public.opportunity_outcomes enable row level security;

-- People manage only their own report.
drop policy if exists "opportunity_outcomes_own" on public.opportunity_outcomes;
create policy "opportunity_outcomes_own" on public.opportunity_outcomes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Public aggregate ──────────────────────────────────────────────────────
create or replace function public.get_opportunity_outcomes(opp_id uuid)
returns table (
  reports        integer,  -- null below 3; -1 means "a few"
  applied        integer,  -- null unless response figures are shown
  heard_back     integer,
  typical_weeks  integer,  -- median response time, applicants who heard back
  show_tips      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select * from opportunity_outcomes where opportunity_id = opp_id
  ), agg as (
    select
      count(*)::int                                                     as n,
      count(*) filter (where applied)::int                              as n_applied,
      count(*) filter (where applied and result is not null and result <> 'no_response')::int as n_heard,
      percentile_disc(0.5) within group (order by response_weeks)
        filter (where applied and response_weeks is not null)           as weeks
    from o
  ), opp as (
    select coalesce(recipients_count, 99) <= 2 as tiny from opportunities where id = opp_id
  )
  select
    case when agg.n < 3 then null else agg.n end,
    case when agg.n_applied >= 5 and not opp.tiny then agg.n_applied end,
    case when agg.n_applied >= 5 and not opp.tiny then
      case when agg.n_heard between 1 and 2 then -1 else agg.n_heard end end,
    case when agg.n_applied >= 5 and not opp.tiny then agg.weeks end,
    agg.n >= 5
  from agg, opp;
$$;

grant execute on function public.get_opportunity_outcomes(uuid) to anon, authenticated;

-- Approved tips, without names, only once there are enough reports.
create or replace function public.get_opportunity_tips(opp_id uuid)
returns table (tip text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.tip, o.created_at
  from opportunity_outcomes o
  where o.opportunity_id = opp_id
    and o.tip is not null
    and o.tip_status = 'approved'
    and (select count(*) from opportunity_outcomes where opportunity_id = opp_id) >= 5
  order by o.created_at desc
  limit 20;
$$;

grant execute on function public.get_opportunity_tips(uuid) to anon, authenticated;

-- ── Six-week prompt log ───────────────────────────────────────────────────
-- One prompt per person per listing, written by the cron (service role).
create table if not exists public.outcome_prompt_sends (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  sent_at        timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

alter table public.outcome_prompt_sends enable row level security;
