-- Archive all active opportunities whose deadline has already passed.
-- Run once in the Supabase SQL editor after deploying Phase 2 of the scraper update.
update opportunities
set is_active = false
where deadline is not null
  and deadline < current_date
  and is_active = true;
