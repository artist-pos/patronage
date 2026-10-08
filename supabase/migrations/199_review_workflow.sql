-- Migration 199: review workflow, private decisions, held results
-- Run after 197 and 198. Safe to re-run.
--
-- The key change: the organiser's working decision no longer lives on the
-- artist's own row. `opportunity_applications.status` is now ONLY what the artist
-- has been told (it starts at 'pending' and changes when results are published).
-- The private decision lives in `application_decisions`, which artists cannot read.

-- ── 1. Private decisions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_decisions (
  application_id    uuid        PRIMARY KEY REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  opportunity_id    uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'shortlisted', 'selected', 'approved_pending_assets', 'production_ready', 'rejected')),
  -- Feedback written for a rejection and a personal note for a selection. Both stay
  -- private until results are published.
  rejection_reason  text,
  selection_message text,
  updated_by        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_decisions_opportunity_idx ON application_decisions (opportunity_id, status);
ALTER TABLE application_decisions ENABLE ROW LEVEL SECURITY;

-- The listing owner, admins and anyone on the review team can read decisions.
-- Artists have no policy here, so they cannot read them. Writes go through
-- server actions that check the caller first.
DROP POLICY IF EXISTS "decisions_select_team" ON application_decisions;
CREATE POLICY "decisions_select_team" ON application_decisions FOR SELECT USING (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = application_decisions.opportunity_id AND o.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators c WHERE c.opportunity_id = application_decisions.opportunity_id AND c.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

-- Everything decided before this change was already emailed, so the working
-- decision simply equals what the artist already sees.
INSERT INTO application_decisions (application_id, opportunity_id, status, rejection_reason)
SELECT a.id, a.opportunity_id, a.status, a.rejection_reason
  FROM opportunity_applications a
 WHERE a.status <> 'pending'
ON CONFLICT (application_id) DO NOTHING;

ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS released_at timestamptz;
UPDATE opportunity_applications
   SET released_at = COALESCE(released_at, now())
 WHERE status <> 'pending' AND released_at IS NULL;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS results_published_at   timestamptz,
  ADD COLUMN IF NOT EXISTS applications_digest_at timestamptz;

-- ── 2. Reviewer assignment ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_assignments (
  application_id uuid        NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  reviewer_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  assigned_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS application_assignments_reviewer_idx ON application_assignments (reviewer_id, opportunity_id);
CREATE INDEX IF NOT EXISTS application_assignments_opportunity_idx ON application_assignments (opportunity_id);
ALTER TABLE application_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_select_own" ON application_assignments;
CREATE POLICY "assignments_select_own" ON application_assignments FOR SELECT USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "assignments_select_owner" ON application_assignments;
CREATE POLICY "assignments_select_owner" ON application_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = application_assignments.opportunity_id AND o.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

-- ── 3. Conflicts of interest ─────────────────────────────────────────────────
-- A reviewer who steps back from an application. They are never assigned it
-- again, and cannot score it.
CREATE TABLE IF NOT EXISTS application_recusals (
  application_id uuid        NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  reviewer_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  recused_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS application_recusals_opportunity_idx ON application_recusals (opportunity_id);
ALTER TABLE application_recusals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recusals_select_own" ON application_recusals;
CREATE POLICY "recusals_select_own" ON application_recusals FOR SELECT USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "recusals_select_owner" ON application_recusals;
CREATE POLICY "recusals_select_owner" ON application_recusals FOR SELECT USING (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = application_recusals.opportunity_id AND o.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

-- ── 4. Notes between reviewers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_notes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  author_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body           text        NOT NULL CHECK (length(btrim(body)) > 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_notes_application_idx ON application_notes (application_id, created_at);
ALTER TABLE application_notes ENABLE ROW LEVEL SECURITY;
-- Reads and writes go through server actions that check team membership.
