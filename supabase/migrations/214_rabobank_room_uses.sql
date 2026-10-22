-- Rabobank survey: "When the event space is in use, what's usually happening?"
-- becomes a pick-up-to-three list. room_scene (213) stays for any answers
-- given to the earlier free-text version.
alter table public.rabobank_survey_response
  add column if not exists room_uses text[] not null default '{}'
    check (cardinality(room_uses) <= 3);
