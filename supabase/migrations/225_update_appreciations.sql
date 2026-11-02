-- 225 — Appreciations on studio updates
--
-- A one-tap "this landed" for the artist. Same rule as follows (016): the
-- count is for the artist and admin only; the public UI must never show it,
-- list who appreciated, or sort by it. Artists hear about appreciations in the
-- Monday email (send-profile-views). See docs/social-phase-1.md, feature 3.
-- Run manually in the Supabase SQL Editor BEFORE deploying the code.

create table if not exists public.update_appreciations (
  update_id   uuid not null references public.project_updates(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Set by the trigger from the update, never by the client.
  artist_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (update_id, user_id)
);

create index if not exists update_appreciations_artist_idx
  on public.update_appreciations (artist_id, created_at desc);
create index if not exists update_appreciations_user_idx
  on public.update_appreciations (user_id);

create or replace function public.update_appreciations_resolve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select artist_id into new.artist_id from project_updates where id = new.update_id;
  if new.artist_id is null then
    raise exception 'update % does not exist', new.update_id;
  end if;
  -- Appreciating your own update means nothing; refuse it quietly at the source.
  if new.artist_id = new.user_id then
    raise exception 'cannot appreciate your own update';
  end if;
  return new;
end;
$$;

drop trigger if exists update_appreciations_resolve on public.update_appreciations;
create trigger update_appreciations_resolve
  before insert on public.update_appreciations
  for each row execute function public.update_appreciations_resolve();

alter table public.update_appreciations enable row level security;

-- The viewer manages and sees only their own appreciations (so the mark shows filled).
drop policy if exists "update_appreciations_own" on public.update_appreciations;
create policy "update_appreciations_own" on public.update_appreciations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The artist can read appreciations of their own updates (counts in studio).
drop policy if exists "update_appreciations_artist_read" on public.update_appreciations;
create policy "update_appreciations_artist_read" on public.update_appreciations
  for select to authenticated
  using (artist_id = (select auth.uid()));
