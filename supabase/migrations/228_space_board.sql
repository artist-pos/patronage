-- 228 — The Here Together pinboard (/partners/here-together/space)
--
-- A public board of notes answering "What do you want out of a creative space?"
-- for a space in Auckland CBD. Anyone can read. Posting needs no account, so
-- every write goes through the server (honeypot, timing, link and rate-limit
-- checks in src/app/partners/here-together/space/actions.ts) using the
-- service role. There are
-- no insert policies for anon or authenticated on purpose: a bot holding the
-- public anon key cannot write here directly.
--
-- Appreciation counts on this board ARE public. That is a deliberate,
-- documented exception to the product principle in CLAUDE.md (engagement
-- numbers stay private): this board is a show of hands for one question, not
-- a ranking of people. The board is never sorted by count.
--
-- Run manually in the Supabase SQL Editor BEFORE deploying the code.
-- Additive and re-runnable.

create table if not exists public.space_notes (
  id                 uuid primary key default gen_random_uuid(),
  body               text not null check (char_length(btrim(body)) between 1 and 280),
  author_name        text not null check (char_length(btrim(author_name)) between 1 and 60),
  -- Set when the poster was signed in; the note still shows only author_name.
  user_id            uuid references public.profiles(id) on delete set null,
  hidden             boolean not null default false,
  hidden_at          timestamptz,
  -- Maintained by the trigger below, never by the client.
  appreciation_count integer not null default 0 check (appreciation_count >= 0),
  created_at         timestamptz not null default now()
);

create index if not exists space_notes_visible_idx
  on public.space_notes (created_at desc) where not hidden;

-- One appreciation per person or device per note. voter_key is 'u:<user id>'
-- for a signed-in viewer, else 'd:<device id>' from an httpOnly cookie. Rows
-- are never readable by the public: only the count on the note is.
create table if not exists public.space_note_appreciations (
  note_id    uuid not null references public.space_notes(id) on delete cascade,
  voter_key  text not null check (voter_key ~ '^[ud]:[0-9a-f-]{36}$'),
  created_at timestamptz not null default now(),
  primary key (note_id, voter_key)
);

create index if not exists space_note_appreciations_voter_idx
  on public.space_note_appreciations (voter_key);

create or replace function public.space_note_appreciations_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update space_notes set appreciation_count = appreciation_count + 1 where id = new.note_id;
    return new;
  else
    update space_notes set appreciation_count = greatest(appreciation_count - 1, 0) where id = old.note_id;
    return old;
  end if;
end;
$$;

drop trigger if exists space_note_appreciations_count on public.space_note_appreciations;
create trigger space_note_appreciations_count
  after insert or delete on public.space_note_appreciations
  for each row execute function public.space_note_appreciations_count();

alter table public.space_notes enable row level security;
alter table public.space_note_appreciations enable row level security;
-- (No policies on space_note_appreciations: service role only.)

-- Everyone reads visible notes. Admins also read hidden ones, so they can unhide.
drop policy if exists "space_notes_read" on public.space_notes;
create policy "space_notes_read" on public.space_notes for select
  using (
    not hidden
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('admin', 'owner')
    )
  );

-- Admins hide and unhide notes. Nobody else can update or delete.
drop policy if exists "space_notes_admin_update" on public.space_notes;
create policy "space_notes_admin_update" on public.space_notes for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('admin', 'owner')
    )
  );

-- Admins may only flip the hidden flag: body, name and count stay as posted.
revoke update on public.space_notes from anon, authenticated;
grant update (hidden, hidden_at) on public.space_notes to authenticated;
