-- =============================================================
-- Patronage — Migration 002: Portfolio Images + Storage
-- Run in: Supabase SQL Editor
-- =============================================================

-- ── portfolio_images table ────────────────────────────────────

create table portfolio_images (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles on delete cascade,
  url        text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

alter table portfolio_images enable row level security;

-- Public can view portfolio images of active profiles
create policy "portfolio_images_select_public"
  on portfolio_images for select
  using (
    exists (
      select 1 from profiles
      where id = profile_id and is_active = true
    )
  );

-- Owner can insert their own images
create policy "portfolio_images_insert_own"
  on portfolio_images for insert
  with check (auth.uid() = profile_id);

-- Owner can delete their own images
create policy "portfolio_images_delete_own"
  on portfolio_images for delete
  using (auth.uid() = profile_id);

-- Admin can do anything
create policy "portfolio_images_admin"
  on portfolio_images for all
  using (is_admin());

-- ── Storage buckets ───────────────────────────────────────────

-- Public bucket for portfolio images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio',
  'portfolio',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Public bucket for CV PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  true,
  10485760, -- 10 MB
  array['application/pdf']
) on conflict (id) do nothing;

-- ── Storage RLS policies ──────────────────────────────────────

-- Portfolio: public read
create policy "portfolio_public_read"
  on storage.objects for select
  using (bucket_id = 'portfolio');

-- Portfolio: owner upload (files must be under {user_id}/ prefix)
create policy "portfolio_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'portfolio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Portfolio: owner delete
create policy "portfolio_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'portfolio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- CVs: public read
create policy "cvs_public_read"
  on storage.objects for select
  using (bucket_id = 'cvs');

-- CVs: owner upload
create policy "cvs_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- CVs: owner delete
create policy "cvs_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
