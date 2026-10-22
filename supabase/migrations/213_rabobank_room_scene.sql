-- Rabobank survey: a short answer describing the event space in use, asked
-- just before "what should the artwork be doing?".
alter table public.rabobank_survey_response
  add column if not exists room_scene text
    check (room_scene is null or char_length(room_scene) <= 200);
