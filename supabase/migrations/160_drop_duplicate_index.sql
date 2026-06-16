-- Supabase linter 0009_duplicate_index.
-- public.project_updates has two identical indexes on (artist_id):
--   idx_project_updates_artist_id  and  project_updates_artist_id_idx
-- Keep one, drop the other. (The *_idx variant was also flagged as unused.)

drop index if exists public.project_updates_artist_id_idx;
