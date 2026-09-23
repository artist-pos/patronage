-- 195: link a listing's organiser to a partner account, and ranked search.
--
-- 1. opportunities.organiser_profile_id — optional link from the free-text
--    `organiser` to a partner account (profiles.role = 'partner', including
--    shadow org accounts). `organiser` stays the display text; the link makes
--    the name clickable and lists the opportunity on that partner's page.
-- 2. search_opportunities() — full-text ranking (title > organiser > caption /
--    tags > description) plus trigram similarity so small typos still match.
--
-- Run in the Supabase SQL Editor BEFORE deploying the code that reads
-- organiser_profile_id.

alter table public.opportunities
  add column if not exists organiser_profile_id uuid
  references public.profiles(id) on delete set null;

create index if not exists opportunities_organiser_profile_id_idx
  on public.opportunities (organiser_profile_id)
  where organiser_profile_id is not null;

-- Listings a partner posted from their own account are, by definition,
-- organised by that partner. Backfill so their public page keeps showing them.
update public.opportunities o
set organiser_profile_id = o.profile_id
from public.profiles p
where p.id = o.profile_id
  and p.role = 'partner'
  and o.organiser_profile_id is null;

create extension if not exists pg_trgm;

create or replace function public.search_opportunities(q text, lim int default 12)
returns table (id uuid, rank real)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with query as (
    select
      websearch_to_tsquery('english', q) as tsq,
      lower(trim(q)) as lq
  )
  select
    o.id,
    (
      ts_rank_cd(
        setweight(to_tsvector('english', coalesce(o.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(o.organiser, '')), 'B') ||
        setweight(to_tsvector('english',
          coalesce(o.caption, '') || ' ' ||
          coalesce(o.type::text, '') || ' ' ||
          coalesce(o.city::text, '') || ' ' ||
          coalesce(o.grant_type::text, '') || ' ' ||
          coalesce(array_to_string(o.sub_categories, ' '), '') || ' ' ||
          coalesce(array_to_string(o.tags, ' '), '')), 'C') ||
        setweight(to_tsvector('english',
          coalesce(o.description, '') || ' ' || coalesce(o.full_description, '')), 'D'),
        query.tsq
      )
      + greatest(
          similarity(lower(coalesce(o.title, '')), query.lq),
          similarity(lower(coalesce(o.organiser, '')), query.lq)
        ) * 0.6
      -- Listings you can still act on outrank closed ones.
      + case when o.deadline is null or o.deadline >= current_date then 0.4 else 0 end
    )::real as rank
  from public.opportunities o, query
  where o.is_active = true
    and o.status = 'published'
    and (
      query.tsq @@ (
        setweight(to_tsvector('english', coalesce(o.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(o.organiser, '')), 'B') ||
        setweight(to_tsvector('english',
          coalesce(o.caption, '') || ' ' ||
          coalesce(o.type::text, '') || ' ' ||
          coalesce(o.city::text, '') || ' ' ||
          coalesce(o.grant_type::text, '') || ' ' ||
          coalesce(array_to_string(o.sub_categories, ' '), '') || ' ' ||
          coalesce(array_to_string(o.tags, ' '), '')), 'C') ||
        setweight(to_tsvector('english',
          coalesce(o.description, '') || ' ' || coalesce(o.full_description, '')), 'D')
      )
      or lower(coalesce(o.title, '')) like '%' || query.lq || '%'
      or lower(coalesce(o.organiser, '')) like '%' || query.lq || '%'
      or similarity(lower(coalesce(o.title, '')), query.lq) > 0.3
      or similarity(lower(coalesce(o.organiser, '')), query.lq) > 0.3
    )
  order by rank desc, o.deadline asc nulls last
  limit greatest(1, least(lim, 50));
$$;

grant execute on function public.search_opportunities(text, int) to anon, authenticated;
