-- 178: Per-work descriptions on pipeline applications.
--
-- The works picker (ApplyModal) lets an artist attach up to `portfolio_pick_count`
-- portfolio works, or one available (for-sale) work. Until now only the artwork
-- ids travelled with the application — the artist's own writeup on the work
-- (artworks.description) never reached the reviewing partner.
--
-- work_descriptions holds ONLY the per-application overrides, keyed by artwork id:
--   { "<artworks.id>": "Written specifically for this application…" }
-- An absent key means "use the live artworks.description" — deliberately not
-- copied in, so edits to the work keep flowing through to open applications.
-- Reader contract (ApplicantPanel): work_descriptions[id] ?? artworks.description.

alter table opportunity_applications
  add column if not exists work_descriptions jsonb not null default '{}'::jsonb;

alter table opportunity_application_drafts
  add column if not exists work_descriptions jsonb not null default '{}'::jsonb;

comment on column opportunity_applications.work_descriptions is
  'Per-application work description overrides, keyed by artworks.id. Absent key = use the live artworks.description.';
comment on column opportunity_application_drafts.work_descriptions is
  'Per-application work description overrides, keyed by artworks.id. Absent key = use the live artworks.description.';
