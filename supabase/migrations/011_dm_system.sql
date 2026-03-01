-- =============================================================
-- Patronage — Migration 011: Direct Messaging System
-- Run in: Supabase SQL Editor
-- =============================================================

-- conversations: links exactly two users
-- participant_a is always the lexicographically smaller UUID
-- to guarantee a single row per pair
create table if not exists conversations (
  id            uuid primary key default gen_random_uuid(),
  participant_a uuid not null references auth.users(id) on delete cascade,
  participant_b uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint no_self_message check (participant_a != participant_b),
  constraint ordered_pair    check (participant_a < participant_b)
);

create unique index if not exists conversations_pair_idx
  on conversations(participant_a, participant_b);

alter table conversations enable row level security;

create policy "conversations_select_participant"
  on conversations for select
  using (auth.uid() = participant_a or auth.uid() = participant_b);

create policy "conversations_insert_participant"
  on conversations for insert
  with check (auth.uid() = participant_a or auth.uid() = participant_b);

-- messages
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  content         text not null,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv_idx on messages(conversation_id, created_at);

alter table messages enable row level security;

create policy "messages_select_participant"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

create policy "messages_insert_participant"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

create policy "messages_update_read_participant"
  on messages for update
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

-- Enable realtime for live chat
alter publication supabase_realtime add table messages;
