-- Migration 146: partner_documents
-- Files uploaded by partners to an opportunity (assessor briefs, PDFs, rubric attachments).
-- Stored in the existing 'opportunity-images' bucket under a documents/ prefix.

CREATE TABLE partner_documents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  label          text        NOT NULL,
  storage_path   text        NOT NULL,
  file_size_kb   integer,
  uploaded_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX partner_documents_opportunity_id_idx ON partner_documents (opportunity_id);

ALTER TABLE partner_documents ENABLE ROW LEVEL SECURITY;

-- All collaborators (including viewers) can read — assessors need access to briefs
CREATE POLICY "partner_documents_select" ON partner_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM opportunities WHERE id = partner_documents.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = partner_documents.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Owner + editor collaborators + admins can upload
CREATE POLICY "partner_documents_insert" ON partner_documents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM opportunities WHERE id = opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = opportunity_id AND profile_id = auth.uid() AND role = 'editor')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Owner + admins can delete
CREATE POLICY "partner_documents_delete" ON partner_documents FOR DELETE USING (
  EXISTS (SELECT 1 FROM opportunities WHERE id = partner_documents.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
