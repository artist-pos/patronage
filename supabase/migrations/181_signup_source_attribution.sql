-- 181 — Signup source attribution
--
-- Records where an account came from, so we can tell which public object
-- actually acquired the user. The opportunity page signup banner is the first
-- writer; the columns are deliberately generic so later surfaces (regional
-- pages, studio update shares, the digest) can use the same two fields.
--
-- signup_source is free text rather than an enum: adding a growth surface
-- should not need a migration.

alter table public.profiles
  add column if not exists signup_source text,
  add column if not exists signup_source_opportunity_id uuid
    references public.opportunities(id) on delete set null,
  add column if not exists signup_source_ref text;

comment on column public.profiles.signup_source is
  'Surface that produced this signup, e.g. "opportunity_page", "regional_page", "digest". Null for organic/direct.';
comment on column public.profiles.signup_source_opportunity_id is
  'The opportunity being viewed when the user signed up, where the source was an opportunity surface.';
comment on column public.profiles.signup_source_ref is
  'The ?ref= value carried into the session that produced this signup, e.g. "share" or "digest".';

-- Attribution reporting filters by source and groups by week.
create index if not exists profiles_signup_source_idx
  on public.profiles (signup_source, created_at desc)
  where signup_source is not null;
