-- 188 — Organisation invitation copy
--
-- Organisations can rewrite the words in their artist invitation. Our copy is
-- the default, shown pre-filled, so doing nothing sends exactly what 187 sent.
--
-- Fields rather than a template. Everything goes out over our sending domain,
-- so one organisation writing something spammy costs deliverability for every
-- other organisation on the platform, and a free-form HTML body pointed at
-- artists who trust the sender is a phishing surface. The frame stays ours: the
-- link, the paragraph telling the artist their profile is their own, and the
-- line saying they can ignore it. Those are what make an organisation's artists
-- safe to hand over in the first place.
--
-- All null means "use the default". That keeps the default editable in code
-- later without rewriting rows that never chose anything.

alter table public.profiles
  add column if not exists org_invite_subject  text,
  add column if not exists org_invite_headline text,
  add column if not exists org_invite_subhead  text,
  add column if not exists org_invite_message  text,
  -- Where a reply goes. An artist who answers the invitation should reach the
  -- organisation that sent it, not our no-reply address. Arguably worth more
  -- than the copy editing: a real conversation is the strongest conversion the
  -- organisation has.
  add column if not exists org_invite_reply_to text;

comment on column public.profiles.org_invite_subject is
  'Subject line for this organisation''s artist invitations. Null uses the Patronage default.';
comment on column public.profiles.org_invite_headline is
  'Opening sentence of the invitation. Null uses the default naming the org and region.';
comment on column public.profiles.org_invite_subhead is
  'The line under the headline. Null uses the default.';
comment on column public.profiles.org_invite_message is
  'Optional extra paragraph in the organisation''s own voice. Null omits it entirely.';
comment on column public.profiles.org_invite_reply_to is
  'Reply-to address on invitations. Null means replies go nowhere useful, so the UI asks for it.';

-- Length caps at the database, not only in the form. These are plain-text
-- fields rendered into an email; nothing here should ever be an essay, and a
-- cap is the cheapest guard against a paste accident becoming a send.
alter table public.profiles
  drop constraint if exists profiles_org_invite_lengths_check;

alter table public.profiles
  add constraint profiles_org_invite_lengths_check
  check (
    (org_invite_subject  is null or length(org_invite_subject)  <= 150)
    and (org_invite_headline is null or length(org_invite_headline) <= 200)
    and (org_invite_subhead  is null or length(org_invite_subhead)  <= 300)
    and (org_invite_message  is null or length(org_invite_message)  <= 600)
    and (org_invite_reply_to is null or length(org_invite_reply_to) <= 254)
  );
