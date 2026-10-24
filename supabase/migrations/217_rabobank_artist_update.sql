-- Rabobank artist flow, update 1: the scale question replaces "new or existing",
-- rotating "thoughts" on Q4, and the creative direction PDF. Same access model
-- as 209/210/216: RLS on, no policies, service-role server code only.

-- Q3 is now "Have you made work at this scale before?". work_type (216) is left
-- in place but no longer written.
alter table public.rabobank_quote
  add column if not exists scale_experience text check (scale_experience in ('often', 'some', 'largest'));

-- When the artist first opened the creative direction PDF, for the admin list.
alter table public.rabobank_artist_invite
  add column if not exists direction_opened_at timestamptz;

-- Where the PDF lives in the private bucket, and when it was last replaced.
alter table public.rabobank_settings
  add column if not exists direction_pdf_path text check (direction_pdf_path is null or char_length(direction_pdf_path) <= 300),
  add column if not exists direction_pdf_uploaded_at timestamptz;

-- Blake's short thoughts about the work, shown to every artist on Q4. Not tied
-- to any invite, so they must never name or identify an artist.
create table if not exists public.rabobank_commission_take (
  id uuid primary key default gen_random_uuid(),
  commission_id text not null default 'rabobank-te-puke',
  text text not null check (char_length(text) between 1 and 600),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rabobank_commission_take enable row level security;
create index if not exists rabobank_commission_take_order_idx on public.rabobank_commission_take (commission_id, sort_order);

-- Private bucket for the creative direction PDF. Never public: the file is
-- only ever streamed through an artist's token link.
insert into storage.buckets (id, name, public)
values ('rabobank-private', 'rabobank-private', false)
on conflict (id) do nothing;
