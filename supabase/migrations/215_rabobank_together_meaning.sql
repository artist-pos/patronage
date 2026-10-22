-- Rabobank survey: "When you think of 'together' here, what do you picture?",
-- asked after the two story questions.
alter table public.rabobank_survey_response
  add column if not exists together_meaning text
    check (together_meaning is null or char_length(together_meaning) <= 300);
