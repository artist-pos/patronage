-- Migration 143: rubric_criteria
-- Scoring rubric for pipeline opportunities. Criteria lock after the first score is submitted.

CREATE TABLE rubric_criteria (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  label          text        NOT NULL,
  helper         text,
  weight         integer     NOT NULL DEFAULT 1 CHECK (weight >= 1),
  scale_max      integer     NOT NULL DEFAULT 5 CHECK (scale_max IN (3, 5, 10)),
  position       integer     NOT NULL DEFAULT 0,
  locked         boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rubric_criteria_opportunity_id_idx ON rubric_criteria (opportunity_id);

ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;

-- Opportunity owner + editor collaborators + admins can read
CREATE POLICY "rubric_criteria_select" ON rubric_criteria FOR SELECT USING (
  EXISTS (SELECT 1 FROM opportunities WHERE id = rubric_criteria.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = rubric_criteria.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Opportunity owner + editor collaborators + admins can insert/update/delete (only if not locked)
CREATE POLICY "rubric_criteria_insert" ON rubric_criteria FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM opportunities WHERE id = opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = opportunity_id AND profile_id = auth.uid() AND role = 'editor')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "rubric_criteria_update" ON rubric_criteria FOR UPDATE USING (
  locked = false
  AND (
    EXISTS (SELECT 1 FROM opportunities WHERE id = rubric_criteria.opportunity_id AND profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = rubric_criteria.opportunity_id AND profile_id = auth.uid() AND role = 'editor')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  )
);

CREATE POLICY "rubric_criteria_delete" ON rubric_criteria FOR DELETE USING (
  locked = false
  AND (
    EXISTS (SELECT 1 FROM opportunities WHERE id = rubric_criteria.opportunity_id AND profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  )
);
