-- Admin-set featured/spotlight artist with an expiry date.
-- The /artists spotlight hero and the home-page artist feature both read
-- the profile with the latest unexpired spotlight_until. Set from the
-- admin 3-dot menu on the artist directory.

alter table profiles
  add column if not exists spotlight_until date;

comment on column profiles.spotlight_until is
  'Featured artist until this date (admin-set). Latest unexpired date wins.';
