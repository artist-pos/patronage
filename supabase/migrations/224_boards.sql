-- 224 — Saves and boards
--
-- A save is intent: a patron keeping works they might acquire, an organisation
-- keeping artists it might commission, an artist keeping references. Boards
-- hold artworks, studio updates and artists. See docs/social-phase-1.md,
-- feature 2. Run manually in the Supabase SQL Editor BEFORE deploying the code
-- that reads these tables.
--
-- Privacy rules:
--   * Boards are private by default; 'link' boards are readable by anyone with
--     the share token, only through get_shared_board(). 'public' is reserved.
--   * Artists never read board_items. They get counts of saves on their own
--     work through board_save_counts(): no who, no which board, and saves by
--     organisations (shortlists) are not counted.

create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  -- 'public' is reserved for later; Phase 1 exposes private and link only.
  visibility  text not null default 'private'
              check (visibility in ('private', 'link', 'public')),
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists boards_owner_idx on public.boards (owner_id, updated_at desc);

create table if not exists public.board_items (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards(id) on delete cascade,
  item_type   text not null check (item_type in ('artwork', 'update', 'artist')),
  item_id     uuid not null,
  -- Set by the trigger below, never by the client. Lets the artist's save
  -- counts be computed without exposing boards.
  artist_id   uuid not null references public.profiles(id) on delete cascade,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (board_id, item_type, item_id)
);

create index if not exists board_items_board_idx on public.board_items (board_id, created_at desc);
create index if not exists board_items_artist_idx on public.board_items (artist_id);
create index if not exists board_items_item_idx on public.board_items (item_type, item_id);

-- ── Integrity: item_id points at one of three tables ──────────────────────
-- Check the item exists, refuse under-18 artists, and fill artist_id.
create or replace function public.board_items_resolve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved uuid;
begin
  if new.item_type = 'artwork' then
    select creator_id into resolved from artworks where id = new.item_id;
  elsif new.item_type = 'update' then
    select artist_id into resolved from project_updates where id = new.item_id;
  elsif new.item_type = 'artist' then
    select id into resolved from profiles
      where id = new.item_id and role in ('artist', 'owner');
  end if;

  if resolved is null then
    raise exception 'board item % % does not exist', new.item_type, new.item_id;
  end if;
  if exists (select 1 from profiles where id = resolved and is_minor) then
    raise exception 'under-18 profiles cannot be saved to boards';
  end if;

  new.artist_id := resolved;
  return new;
end;
$$;

drop trigger if exists board_items_resolve on public.board_items;
create trigger board_items_resolve
  before insert or update of item_type, item_id on public.board_items
  for each row execute function public.board_items_resolve();

-- A deleted work or update disappears from boards quietly. Deleted artist
-- profiles are covered by the artist_id foreign key.
create or replace function public.board_items_remove_artwork()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from board_items where item_type = 'artwork' and item_id = old.id;
  return old;
end;
$$;

create or replace function public.board_items_remove_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from board_items where item_type = 'update' and item_id = old.id;
  return old;
end;
$$;

drop trigger if exists board_items_remove_artwork on public.artworks;
create trigger board_items_remove_artwork
  after delete on public.artworks
  for each row execute function public.board_items_remove_artwork();

drop trigger if exists board_items_remove_update on public.project_updates;
create trigger board_items_remove_update
  after delete on public.project_updates
  for each row execute function public.board_items_remove_update();

-- Adding or removing items bumps the board so lists sort by recent use.
create or replace function public.boards_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update boards set updated_at = now()
  where id = case when tg_op = 'DELETE' then old.board_id else new.board_id end;
  return null;
end;
$$;

drop trigger if exists board_items_touch on public.board_items;
create trigger board_items_touch
  after insert or delete on public.board_items
  for each row execute function public.boards_touch();

-- ── RLS: owners only ───────────────────────────────────────────────────────
alter table public.boards enable row level security;
alter table public.board_items enable row level security;

drop policy if exists "boards_owner_all" on public.boards;
create policy "boards_owner_all" on public.boards
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and visibility in ('private', 'link'));

drop policy if exists "board_items_owner_all" on public.board_items;
create policy "board_items_owner_all" on public.board_items
  for all to authenticated
  using (exists (select 1 from boards b where b.id = board_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from boards b where b.id = board_id and b.owner_id = (select auth.uid())));

-- ── Shared link ────────────────────────────────────────────────────────────
-- Read a 'link' board by its token. Hidden studio updates and works hidden
-- from the archive drop off shared boards (they stay for the owner).
create or replace function public.get_shared_board(token text)
returns table (
  board_id uuid, title text, description text, owner_username text, owner_name text,
  item_type text, item_id uuid, item_created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.title, b.description, p.username, p.full_name,
         i.item_type, i.item_id, i.created_at
  from boards b
  join profiles p on p.id = b.owner_id
  left join board_items i on i.board_id = b.id
    and not (i.item_type = 'update' and exists (
      select 1 from project_updates u where u.id = i.item_id and u.admin_hidden))
    and not (i.item_type = 'artwork' and exists (
      select 1 from artworks a where a.id = i.item_id and a.hide_from_archive))
  where b.share_token = token and b.visibility = 'link'
  order by i.created_at desc nulls last;
$$;

grant execute on function public.get_shared_board(text) to anon, authenticated;

-- ── Private save counts for the artist ────────────────────────────────────
-- Saves on the caller's own work. Excludes their own saves and organisation
-- shortlists (partner boards), which the artist never learns about.
create or replace function public.board_save_counts()
returns table (item_type text, item_id uuid, saves bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.item_type, i.item_id, count(distinct b.owner_id)
  from board_items i
  join boards b on b.id = i.board_id
  join profiles o on o.id = b.owner_id
  where i.artist_id = (select auth.uid())
    and b.owner_id <> (select auth.uid())
    and o.role <> 'partner'
  group by i.item_type, i.item_id;
$$;

grant execute on function public.board_save_counts() to authenticated;

-- ── Invite to apply (organisation shortlists) ─────────────────────────────
-- One invitation per artist per opportunity. Written by the server action
-- (service role) after checking the caller organises the opportunity.
create table if not exists public.opportunity_invites (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  artist_id      uuid not null references public.profiles(id) on delete cascade,
  org_id         uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, artist_id)
);

alter table public.opportunity_invites enable row level security;

drop policy if exists "opportunity_invites_parties_read" on public.opportunity_invites;
create policy "opportunity_invites_parties_read" on public.opportunity_invites
  for select to authenticated
  using (org_id = (select auth.uid()) or artist_id = (select auth.uid()));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'sale', 'support', 'transfer_request', 'transfer_accepted', 'note',
    'roster_invite', 'roster_accepted', 'roster_declined', 'roster_left', 'roster_removed',
    'org_opportunity', 'opportunity_invite'
  ));
