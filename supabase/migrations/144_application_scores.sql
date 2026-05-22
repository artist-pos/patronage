-- Migration 144: application_scores
-- Per-reviewer, per-criterion scores for pipeline applications.
-- Inserting the first score for an opportunity locks all rubric_criteria for that opportunity.

CREATE TABLE application_scores (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  criterion_id   uuid        NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  reviewer_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score          integer     NOT NULL CHECK (score >= 1),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, reviewer_id, criterion_id)
);

CREATE INDEX application_scores_application_id_idx ON application_scores (application_id);
CREATE INDEX application_scores_reviewer_id_idx     ON application_scores (reviewer_id);

ALTER TABLE application_scores ENABLE ROW LEVEL SECURITY;

-- Reviewers can see/insert/update their own scores
CREATE POLICY "application_scores_select_own" ON application_scores FOR SELECT USING (
  reviewer_id = auth.uid()
);

-- Opportunity owner + admins can see all scores
CREATE POLICY "application_scores_select_owner" ON application_scores FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM opportunity_applications oa
    JOIN opportunities o ON o.id = oa.opportunity_id
    WHERE oa.id = application_scores.application_id AND o.profile_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "application_scores_insert" ON application_scores FOR INSERT WITH CHECK (
  reviewer_id = auth.uid()
  AND (
    -- must be opportunity owner, editor collaborator, or admin
    EXISTS (
      SELECT 1 FROM opportunity_applications oa
      JOIN opportunities o ON o.id = oa.opportunity_id
      WHERE oa.id = application_id
        AND (
          o.profile_id = auth.uid()
          OR EXISTS (SELECT 1 FROM opportunity_collaborators oc WHERE oc.opportunity_id = o.id AND oc.profile_id = auth.uid() AND oc.role = 'editor')
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
        )
    )
  )
);

CREATE POLICY "application_scores_update" ON application_scores FOR UPDATE USING (
  reviewer_id = auth.uid()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_application_scores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER application_scores_updated_at
  BEFORE UPDATE ON application_scores
  FOR EACH ROW EXECUTE FUNCTION set_application_scores_updated_at();

-- conflict_application_ids column on opportunity_collaborators
-- lets a reviewer declare conflicts so those applications are hidden from their scoring view
ALTER TABLE opportunity_collaborators
  ADD COLUMN IF NOT EXISTS conflict_application_ids uuid[] NOT NULL DEFAULT '{}';
