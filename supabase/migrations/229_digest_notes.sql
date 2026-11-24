-- 229 — A note from the editor at the top of the next digest
--
-- One optional passage per audience, written in the admin digest screen and
-- shown above the picks in the next issue. It is consumed on send, so an old
-- announcement never repeats: the artist note clears once half B has gone out
-- (the artist digest is sent in two halves, Tuesday and Wednesday, and both
-- should carry it), the organisations' note clears after its own send.
--
-- Server only. RLS is on with no policies, so nobody but the service role reads
-- or writes it.
--
-- Run manually in the Supabase SQL Editor BEFORE deploying the code.
-- Additive and re-runnable.

create table if not exists public.digest_notes (
  audience   text primary key check (audience in ('artist', 'partner')),
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  updated_at timestamptz not null default now()
);

alter table public.digest_notes enable row level security;
