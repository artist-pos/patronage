-- Rabobank staff shortlist: a 1 to 10 score per artist, from "Not for this
-- space" (1) through "Not sure" to "Speaks to me" (10). The three-way reaction
-- (210) is still written, worked out from the score, so existing summaries keep
-- working: 1-3 not_for_space, 4-7 unsure, 8-10 speaks. Null for answers given
-- before the scale existed.
alter table public.rabobank_reaction
  add column if not exists score smallint check (score is null or score between 1 and 10);
