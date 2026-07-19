-- 172: Cross-source dedupe support for scraped opportunities.
--
-- The scraper now collapses cross-posted duplicates (same open call listed on
-- 3-4 aggregators) into one canonical record:
--   * alternate_source_urls — every other source URL the opportunity was seen
--     at, retained for attribution when duplicates collapse
--   * duplicate_of — set on records demoted by the retroactive dedupe pass
--     (scraper/tools/dedupe-pass.ts); canonical records keep NULL
--
-- Run manually in the Supabase SQL Editor.

alter table opportunities
  add column if not exists alternate_source_urls text[] not null default '{}';

alter table opportunities
  add column if not exists duplicate_of uuid references opportunities(id) on delete set null;

comment on column opportunities.alternate_source_urls is
  'Other source URLs this opportunity was cross-posted at (dedupe attribution)';
comment on column opportunities.duplicate_of is
  'Set when this record was collapsed into a canonical duplicate by the dedupe pass';

create index if not exists idx_opportunities_duplicate_of
  on opportunities (duplicate_of) where duplicate_of is not null;
