-- =============================================================
-- Patronage — Migration 006: Opportunity Submissions (Partner Form)
-- Run in: Supabase SQL Editor
-- =============================================================

create table opportunity_submissions (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  organiser           text not null,
  description         text,
  type                text not null,
  country             text not null,
  deadline            date,
  url                 text,
  funding_amount      integer,
  featured_image_url  text,
  grant_type          text,
  recipients_count    integer,
  submitter_email     text,
  status              text not null default 'pending',
  created_at          timestamptz not null default now()
);

alter table opportunity_submissions enable row level security;

create policy "submissions_insert_public"
  on opportunity_submissions for insert with check (true);

create policy "submissions_select_admin"
  on opportunity_submissions for select using (is_admin());

create policy "submissions_update_admin"
  on opportunity_submissions for update using (is_admin());

-- Public bucket for partner-submitted images (pending review)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

create policy "submissions_storage_read_public"
  on storage.objects for select
  using (bucket_id = 'submissions');

create policy "submissions_storage_insert_public"
  on storage.objects for insert
  with check (bucket_id = 'submissions');
