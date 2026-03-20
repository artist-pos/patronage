-- 062: Add tags and career_stage columns to opportunities and opportunity_submissions

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS career_stage text[] DEFAULT '{}';

ALTER TABLE opportunity_submissions
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS career_stage text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_opportunities_tags ON opportunities USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_opportunities_career_stage ON opportunities USING GIN(career_stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_sub_categories ON opportunities USING GIN(sub_categories);
