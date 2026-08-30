-- 179: Source attribution for listings aggregated from someone else's board.
--
-- `source` holds a stable registry key (see src/lib/opportunity-sources.ts) —
-- not a display name — so the label and the link-back can be changed in code
-- without a data migration. NULL means the listing isn't attributed to anyone:
-- we found it ourselves, or a partner submitted it directly.
--
-- Run manually in the Supabase SQL Editor.

alter table opportunities
  add column if not exists source text;

comment on column opportunities.source is
  'Attribution key for the board this listing was taken from (e.g. the_big_idea); NULL = not sourced from a third party. Keys are defined in src/lib/opportunity-sources.ts';

-- Partial index: the admin "sourced from" filter only ever asks for non-null
-- keys, and attributed listings are a small slice of the table.
create index if not exists idx_opportunities_source
  on opportunities (source) where source is not null;

-- Backfill: everything the scraper picked up off The Big Idea. Matches on
-- source_url only (the page we actually took the listing from) — a TBI URL
-- sitting in alternate_source_urls means the listing was cross-posted there
-- but came to us from its canonical organiser page, so it isn't TBI-sourced.
-- Safe to re-run: only fills rows that have no source yet.
update opportunities
set source = 'the_big_idea'
where source is null
  and source_url ~* 'thebigidea\.(co\.)?nz';
