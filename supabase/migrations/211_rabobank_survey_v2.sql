-- Rabobank Te Puke pilot: the revised staff survey (eight reflective questions).
-- Adds columns alongside the originals in 209 so nothing already submitted is lost.
-- Names stay in first_name and are still nulled by the admin "delete all names" action.

alter table public.rabobank_survey_response
  add column if not exists art_relation text
    check (art_relation is null or char_length(art_relation) <= 120),
  add column if not exists art_relation_note text
    check (art_relation_note is null or char_length(art_relation_note) <= 200),
  add column if not exists story_together text
    check (story_together is null or char_length(story_together) <= 300),
  add column if not exists story_place text
    check (story_place is null or char_length(story_place) <= 300),
  add column if not exists story_cooperation text
    check (story_cooperation is null or char_length(story_cooperation) <= 300),
  add column if not exists room_wants text[] not null default '{}'
    check (cardinality(room_wants) <= 3),
  add column if not exists feels_wrong text
    check (feels_wrong is null or char_length(feels_wrong) <= 200),
  add column if not exists memorable_artwork text
    check (memorable_artwork is null or char_length(memorable_artwork) <= 200),
  add column if not exists local_artist text
    check (local_artist is null or char_length(local_artist) <= 200);
