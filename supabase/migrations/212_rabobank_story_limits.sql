-- Rabobank survey: the two story questions (working together, pulling
-- together) get room for a fuller answer. Place stays at 300.
alter table rabobank_survey_response
  drop constraint if exists rabobank_survey_response_story_together_check,
  drop constraint if exists rabobank_survey_response_story_cooperation_check;

alter table rabobank_survey_response
  add constraint rabobank_survey_response_story_together_check
    check (story_together is null or char_length(story_together) <= 500),
  add constraint rabobank_survey_response_story_cooperation_check
    check (story_cooperation is null or char_length(story_cooperation) <= 500);
