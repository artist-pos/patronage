-- Columns used by the scraper to avoid re-fetching and re-extracting unchanged pages.
alter table opportunities
    add column if not exists last_seen_at timestamptz,
    add column if not exists source_etag text,
    add column if not exists source_content_hash text;
