-- Migration 177: admin_hidden moderation flag on project_updates
--
-- Lets an admin/owner pull an individual studio update off two discovery surfaces
-- without deleting it and without telling the artist. Narrow on purpose:
--
--   HIDDEN from signed-out visitors, and only here:
--     /  (landing "From the studio" strip)  src/app/page.tsx     post-cache filter
--     /feed + /api/feed                     src/lib/feed.ts      getLatestUpdates
--
--   UNCHANGED for everyone, everywhere else — including signed-out visitors:
--     /<username> artist profile            getArtistUpdates
--     /projects/[id], /updates/[id]         getUpdateById
--     /threads/[id] project threads         getThread
--     /studio                               (auth-gated anyway)
--
-- So this is discovery suppression, not takedown: the post keeps its own page,
-- its direct link, its place in the artist's profile and project thread. It just
-- stops being surfaced to visitors browsing the landing page or the feed. Any
-- signed-in viewer sees it on those two surfaces too.
--
-- Deliberately a query filter rather than RLS or a status column: RLS would cut
-- the row off from every read path at once, which is the opposite of the above.
-- Consequence: the row stays readable to the anon key by id via the API.
--
-- NOT NULL DEFAULT false: every existing update stays visible.

ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS admin_hidden boolean NOT NULL DEFAULT false;

-- The signed-out /feed read adds `WHERE admin_hidden = false` to an ORDER BY
-- created_at DESC scan. Partial index on the flagged rows only — they're the rare
-- case, so this stays tiny while letting the planner skip them cheaply.
CREATE INDEX IF NOT EXISTS project_updates_admin_hidden_idx
  ON project_updates (created_at DESC)
  WHERE admin_hidden;
