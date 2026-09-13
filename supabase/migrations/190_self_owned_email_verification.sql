-- 190: Self-owned email verification.
--
-- Supabase's built-in confirmation is all-or-nothing: with it on, signUp
-- returns no session and the account cannot do anything until the inbox is
-- opened; with it off, auth.users.email_confirmed_at is stamped at creation
-- and stops meaning anything. We want the middle state — a usable account that
-- has not yet proved it owns the address — so verification moves onto profiles
-- where we control it.
--
-- The token is stored as a SHA-256 hash, never in the clear. profiles is
-- publicly readable, so a raw token column would let any visitor verify any
-- account. The usable secret exists only in the email.

alter table profiles
  add column if not exists email_verified_at     timestamptz,
  add column if not exists email_verify_hash     text,
  add column if not exists email_verify_sent_at  timestamptz;

create unique index if not exists profiles_email_verify_hash_idx
  on profiles (email_verify_hash)
  where email_verify_hash is not null;

comment on column profiles.email_verified_at is
  'When the address was proved. Null means unverified: can browse and save, cannot apply, receives no digest.';
comment on column profiles.email_verify_hash is
  'SHA-256 of the current verification token. Cleared on success.';
comment on column profiles.email_verify_sent_at is
  'Last verification send, for rate limiting. Supabase no longer throttles this for us.';

-- Everyone who already confirmed through Supabase keeps that status. Without
-- this backfill every existing account would wake up to the banner.
update profiles p
set email_verified_at = u.email_confirmed_at
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is not null
  and p.email_verified_at is null;
