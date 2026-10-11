-- Display preferences for the opportunity-listing screens (accessibility view,
-- larger text, reduced motion). The browser cookie is what renders the page;
-- this column lets a signed-in partner's choice follow them to another device.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ui_prefs jsonb;
