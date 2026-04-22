-- Add scraper confidence field to opportunities
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS confidence text CHECK (confidence IN ('high', 'medium', 'low'));
