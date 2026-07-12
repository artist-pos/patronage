-- Open for commissions — artist-set availability status (v2 canvas feature).
-- Shown as a green status dot on the profile cover and artist cards, a
-- commissions block beside the CV, and a filter on /artists.

alter table profiles
  add column if not exists open_for_commissions boolean not null default false;

alter table profiles
  add column if not exists commission_info text;

comment on column profiles.open_for_commissions is
  'Artist accepts commission enquiries — drives the green status dot + directory filter';
comment on column profiles.commission_info is
  'Free text shown in the profile commissions block (media, lead time, etc.)';
