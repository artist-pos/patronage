-- 230 — Link cards on studio updates
--
-- When a studio update contains a link, the first one is fetched once (title,
-- description, image, site name) and stored here so the update page can show a
-- card under the text, the way X does. Resolved on create and on edit by the
-- server (src/lib/link-preview.ts); never fetched when someone views the page.
--
-- Shape: { url, title, description, image, site }, any of the last four may be
-- null. Anything rendering it must treat it as untrusted and only follow http(s).
--
-- Run manually in the Supabase SQL Editor BEFORE deploying the code.
-- Additive and re-runnable.

alter table public.project_updates
  add column if not exists link_preview jsonb;
