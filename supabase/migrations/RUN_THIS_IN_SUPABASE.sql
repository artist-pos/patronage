-- =============================================================
-- Patronage — Consolidated catch-up migrations 005–010
-- Paste the ENTIRE contents of this file into the Supabase
-- SQL Editor and click "Run".  Safe to run more than once.
-- =============================================================

-- ── 005: Extended opportunity fields ──────────────────────────
alter table opportunities
  add column if not exists funding_amount    integer,
  add column if not exists featured_image_url text,
  add column if not exists grant_type        text,
  add column if not exists recipients_count  integer;

-- ── 006: Opportunity submissions table ────────────────────────
create table if not exists opportunity_submissions (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  organiser           text not null,
  description         text,
  type                text not null default 'Grant',
  country             text not null default 'NZ',
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

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunity_submissions' and policyname = 'submissions_insert_public'
  ) then
    create policy "submissions_insert_public"
      on opportunity_submissions for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunity_submissions' and policyname = 'submissions_select_admin'
  ) then
    create policy "submissions_select_admin"
      on opportunity_submissions for select using (is_admin());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunity_submissions' and policyname = 'submissions_update_admin'
  ) then
    create policy "submissions_update_admin"
      on opportunity_submissions for update using (is_admin());
  end if;
end $$;

-- ── 007: funding_range + sub_categories ───────────────────────
alter table opportunities
  add column if not exists funding_range   text,
  add column if not exists sub_categories text[];

alter table opportunity_submissions
  add column if not exists funding_range   text,
  add column if not exists sub_categories text[];

-- ── 008: banner focal point ───────────────────────────────────
alter table profiles
  add column if not exists banner_focus_y integer not null default 50;

-- ── 009: opportunity-images storage bucket ────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'opportunity-images',
  'opportunity-images',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and policyname = 'opp_images_insert_public'
  ) then
    create policy "opp_images_insert_public"
      on storage.objects for insert
      with check (bucket_id = 'opportunity-images');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and policyname = 'opp_images_select_public'
  ) then
    create policy "opp_images_select_public"
      on storage.objects for select
      using (bucket_id = 'opportunity-images');
  end if;
end $$;

-- ── 010: city column ──────────────────────────────────────────
alter table opportunities
  add column if not exists city text;

alter table opportunity_submissions
  add column if not exists city text;
