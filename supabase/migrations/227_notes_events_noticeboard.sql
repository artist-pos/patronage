-- 227 — Note replies, events on studio updates, and the noticeboard
--
-- Run manually in the Supabase SQL Editor before deploying the code that uses
-- it. Everything here is additive and re-runnable.
--
-- 1. Notes on studio updates get one level of replies, an artist switch to turn
--    notes off for a post, and per-person mutes.
-- 2. A studio update can be an event: date, time, venue, region. After the date
--    the artist is asked once whether to add it to their exhibitions.
-- 3. The noticeboard: short asks and offers between artists that run for 30
--    days, with public replies.
-- 4. Reports on notes, notices and replies, read by admins.
-- Under-18 profiles can read all of it but cannot post notes, notices or
-- replies (their messaging is already off, migration 202).

-- ── 1. Notes ────────────────────────────────────────────────────────────────

alter table public.project_notes
  add column if not exists parent_id uuid references public.project_notes(id) on delete cascade;
create index if not exists project_notes_parent_id_idx on public.project_notes(parent_id);

alter table public.project_updates
  add column if not exists notes_off boolean not null default false;

-- Replies are one level deep: a reply to a reply hangs off the same top note.
-- Notes are refused on posts with notes off, from under-18 profiles, and when
-- the parent belongs to another update.
create or replace function public.project_notes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_update uuid;
  parent_parent uuid;
begin
  if exists (select 1 from project_updates where id = new.update_id and notes_off) then
    raise exception 'notes are off for this update';
  end if;
  if exists (select 1 from profiles where id = new.sender_id and coalesce(is_minor, false)) then
    raise exception 'under-18 profiles cannot post notes';
  end if;
  if new.parent_id is not null then
    select update_id, parent_id into parent_update, parent_parent
      from project_notes where id = new.parent_id;
    if parent_update is null or parent_update <> new.update_id then
      raise exception 'reply must be on the same update';
    end if;
    if parent_parent is not null then
      new.parent_id := parent_parent;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists project_notes_guard on public.project_notes;
create trigger project_notes_guard
  before insert on public.project_notes
  for each row execute function public.project_notes_guard();

create table if not exists public.update_note_mutes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  update_id  uuid not null references public.project_updates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, update_id)
);
alter table public.update_note_mutes enable row level security;
drop policy if exists "update_note_mutes_own" on public.update_note_mutes;
create policy "update_note_mutes_own" on public.update_note_mutes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── 2. Events ───────────────────────────────────────────────────────────────

alter table public.project_updates
  add column if not exists event_date date,
  add column if not exists event_time time,
  add column if not exists event_venue text check (event_venue is null or char_length(event_venue) <= 160),
  add column if not exists event_region_id uuid references public.regions(id) on delete set null,
  add column if not exists event_cv_status text check (event_cv_status in ('added', 'dismissed'));

create index if not exists project_updates_event_date_idx
  on public.project_updates(event_date) where event_date is not null;

-- ── 3. Noticeboard ──────────────────────────────────────────────────────────

create table if not exists public.notices (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('wanted', 'offering', 'studio_space', 'services', 'collaborate')),
  body         text not null check (char_length(body) between 1 and 160),
  region_id    uuid references public.regions(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days'),
  sorted_at    timestamptz,
  admin_hidden boolean not null default false
);
create index if not exists notices_active_idx on public.notices(created_at desc) where sorted_at is null;
create index if not exists notices_author_idx on public.notices(author_id);

create table if not exists public.notice_replies (
  id         uuid primary key default gen_random_uuid(),
  notice_id  uuid not null references public.notices(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notice_replies_notice_idx on public.notice_replies(notice_id, created_at);

create table if not exists public.notice_mutes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  notice_id  uuid not null references public.notices(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

-- Posting and replying: signed-in adults only, and only while the notice is live.
create or replace function public.notices_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from profiles where id = new.author_id and coalesce(is_minor, false)) then
    raise exception 'under-18 profiles cannot post on the noticeboard';
  end if;
  if tg_table_name = 'notice_replies' and not exists (
    select 1 from notices
    where id = new.notice_id and sorted_at is null and expires_at > now() and not admin_hidden
  ) then
    raise exception 'this notice is closed';
  end if;
  return new;
end;
$$;

drop trigger if exists notices_guard on public.notices;
create trigger notices_guard before insert on public.notices
  for each row execute function public.notices_guard();
drop trigger if exists notice_replies_guard on public.notice_replies;
create trigger notice_replies_guard before insert on public.notice_replies
  for each row execute function public.notices_guard();

alter table public.notices enable row level security;
alter table public.notice_replies enable row level security;
alter table public.notice_mutes enable row level security;

-- Live notices are public. The author always sees their own.
drop policy if exists "notices_read" on public.notices;
create policy "notices_read" on public.notices for select
  using (
    (not admin_hidden and sorted_at is null and expires_at > now())
    or author_id = (select auth.uid())
  );
drop policy if exists "notices_insert_own" on public.notices;
create policy "notices_insert_own" on public.notices for insert to authenticated
  with check (author_id = (select auth.uid()));
drop policy if exists "notices_update_own" on public.notices;
create policy "notices_update_own" on public.notices for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
drop policy if exists "notices_delete_own" on public.notices;
create policy "notices_delete_own" on public.notices for delete to authenticated
  using (author_id = (select auth.uid()));

-- Replies are public unless the notice's author hid them; a hidden reply stays
-- visible to its own author and the notice's author.
drop policy if exists "notice_replies_read" on public.notice_replies;
create policy "notice_replies_read" on public.notice_replies for select
  using (
    not hidden
    or author_id = (select auth.uid())
    or exists (select 1 from notices n where n.id = notice_id and n.author_id = (select auth.uid()))
  );
drop policy if exists "notice_replies_insert_own" on public.notice_replies;
create policy "notice_replies_insert_own" on public.notice_replies for insert to authenticated
  with check (author_id = (select auth.uid()));
drop policy if exists "notice_replies_hide" on public.notice_replies;
create policy "notice_replies_hide" on public.notice_replies for update to authenticated
  using (exists (select 1 from notices n where n.id = notice_id and n.author_id = (select auth.uid())));
drop policy if exists "notice_replies_delete_own" on public.notice_replies;
create policy "notice_replies_delete_own" on public.notice_replies for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "notice_mutes_own" on public.notice_mutes;
create policy "notice_mutes_own" on public.notice_mutes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── 4. Reports ──────────────────────────────────────────────────────────────

create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  item_type   text not null check (item_type in ('note', 'notice', 'notice_reply')),
  item_id     uuid not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (reporter_id, item_type, item_id)
);
alter table public.content_reports enable row level security;
-- Anyone signed in can file a report; only admins (service role) read them.
drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own" on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- ── 5. Notification types ───────────────────────────────────────────────────

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'sale', 'support', 'transfer_request', 'transfer_accepted', 'note',
    'roster_invite', 'roster_accepted', 'roster_declined', 'roster_left', 'roster_removed',
    'org_opportunity', 'opportunity_invite',
    'note_reply', 'notice_reply'
  ));
