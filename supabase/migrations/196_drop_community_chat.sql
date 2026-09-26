-- Migration 196: drop community chat
--
-- The community chat (nav bar chat bubble, migration 127) has been removed from
-- the app. Its messages are not being kept. Dropping a table also drops its
-- policies, indexes and realtime publication membership.
--
-- No CASCADE on purpose: if anything else still depends on these tables, this
-- fails and names it rather than silently dropping it too.

DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_channels;
