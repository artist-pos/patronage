-- 202: profiles of people under 18 stay off every public list and out of search.
--
-- A minor's profile still opens from their own link (so they can share it with
-- an art school or a scholarship panel), but it is noindex, left out of the
-- sitemap, and not shown in directories, regions, search, the feed or the
-- digest. The rule is read from year_of_birth, which is already collected:
--
--   current year - year of birth <= 17   under 18, always
--   current year - year of birth  = 18   could be 17 or 18: the person says
--                                        which (age_confirmed_adult)
--   current year - year of birth >= 19   an adult
--
-- No year of birth means no flag. is_minor is derived, never shown, and kept up
-- to date by the trigger below and by refresh_minor_flags() once a day.

alter table public.profiles
  add column if not exists age_confirmed_adult boolean not null default false,
  add column if not exists is_minor boolean not null default false;

create or replace function public.profile_is_minor(yob integer, confirmed boolean)
returns boolean
language sql
stable
as $$
  select yob is not null
    and (
      extract(year from now())::integer - yob <= 17
      or (extract(year from now())::integer - yob = 18 and not coalesce(confirmed, false))
    );
$$;

create or replace function public.set_profile_is_minor()
returns trigger
language plpgsql
as $$
begin
  new.is_minor := public.profile_is_minor(new.year_of_birth, new.age_confirmed_adult);
  return new;
end;
$$;

drop trigger if exists profiles_set_is_minor on public.profiles;
create trigger profiles_set_is_minor
  before insert or update of year_of_birth, age_confirmed_adult on public.profiles
  for each row execute function public.set_profile_is_minor();

-- The year rolls over once a year, so the stored flag has to be refreshed even
-- when nobody edits their profile. Called by /api/cron/refresh-minor-flags.
create or replace function public.refresh_minor_flags()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.profiles
     set is_minor = public.profile_is_minor(year_of_birth, age_confirmed_adult)
   where is_minor is distinct from public.profile_is_minor(year_of_birth, age_confirmed_adult);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.refresh_minor_flags() from public, anon, authenticated;

-- Backfill.
update public.profiles
   set is_minor = public.profile_is_minor(year_of_birth, age_confirmed_adult)
 where year_of_birth is not null;

create index if not exists profiles_is_minor_idx on public.profiles (is_minor) where is_minor;

comment on column public.profiles.is_minor is
  'Derived from year_of_birth (migration 202). True = under 18, or possibly 17 and not yet confirmed 18. Kept off all public lists and out of search; the profile still opens from its own link.';
comment on column public.profiles.age_confirmed_adult is
  'Set by the person when current year - year_of_birth = 18 and they say they have turned 18.';

-- ── Messaging is closed to under-18s, both ways ─────────────────────────────
-- The server actions check this first; these triggers are the backstop for any
-- path that is missed. System messages written with the service role (auth.uid()
-- is null) are not blocked here: those code paths check is_minor themselves.

create or replace function public.block_minor_conversations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.profiles
     where id in (new.participant_a, new.participant_b) and is_minor
  ) then
    raise exception 'messaging_unavailable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_block_minors on public.conversations;
create trigger conversations_block_minors
  before insert on public.conversations
  for each row execute function public.block_minor_conversations();

create or replace function public.block_minor_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and exists (
    select 1
      from public.conversations c
      join public.profiles p on p.id in (c.participant_a, c.participant_b)
     where c.id = new.conversation_id and p.is_minor
  ) then
    raise exception 'messaging_unavailable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_block_minors on public.messages;
create trigger messages_block_minors
  before insert on public.messages
  for each row execute function public.block_minor_messages();
