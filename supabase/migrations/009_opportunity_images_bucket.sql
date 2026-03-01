-- Migration 009: dedicated storage bucket for opportunity images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'opportunity-images',
  'opportunity-images',
  true,
  20971520, -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Anyone can upload (partner submission form is unauthenticated)
create policy "opp_images_insert_public"
  on storage.objects for insert
  with check (bucket_id = 'opportunity-images');

-- Public read
create policy "opp_images_select_public"
  on storage.objects for select
  using (bucket_id = 'opportunity-images');
