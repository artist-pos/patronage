-- An optional event on a listing: an opening night, launch, artist talk. When
-- set, the listing shows in Explore > Events (newest-first by date) and on its
-- own page, so an organisation adds the date once and gets both.
--
-- event_label is free text such as "Opening night"; the UI falls back to "Event".
-- Dates are NZ local calendar dates, same as studio-update events (227).

alter table public.opportunities
  add column if not exists event_date date,
  add column if not exists event_time time,
  add column if not exists event_venue text check (event_venue is null or char_length(event_venue) <= 200),
  add column if not exists event_label text check (event_label is null or char_length(event_label) <= 60);

-- Explore reads upcoming events across published listings.
create index if not exists opportunities_event_date_idx
  on public.opportunities (event_date)
  where event_date is not null;
