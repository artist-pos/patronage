-- Rabobank artist flow, update 1: the scale question replaces "new or existing",
-- per-invite "thoughts" on Q4, a second featured image, and the creative direction PDF. Same access model
-- as 209/210/216: RLS on, no policies, service-role server code only.

-- Q3 is now "Have you made work at this scale before?". work_type (216) is left
-- in place but no longer written.
alter table public.rabobank_quote
  add column if not exists scale_experience text check (scale_experience in ('often', 'some', 'largest'));

-- "These amounts are": plus GST, including GST, or not GST registered. Replaces
-- the yes/no toggle; gst_inclusive (216) is still written, true only for 'incl'.
alter table public.rabobank_quote
  add column if not exists gst_treatment text check (gst_treatment in ('plus', 'incl', 'none'));

-- When the artist first opened the creative direction PDF, for the admin list.
alter table public.rabobank_artist_invite
  add column if not exists direction_opened_at timestamptz;

-- Where the PDF lives in the private bucket, and when it was last replaced.
alter table public.rabobank_settings
  add column if not exists direction_pdf_path text check (direction_pdf_path is null or char_length(direction_pdf_path) <= 300),
  add column if not exists direction_pdf_uploaded_at timestamptz;

-- Blake's short thoughts about the work, written per invite and shown only to
-- that artist on Q4, one at a time.
alter table public.rabobank_artist_invite
  add column if not exists thoughts text[] not null default '{}' check (cardinality(thoughts) <= 12);

-- A second featured image: the two works that caught Blake's eye.
alter table public.rabobank_artist_invite
  add column if not exists featured_image_2_url text check (featured_image_2_url is null or char_length(featured_image_2_url) <= 500),
  add column if not exists featured_title_2 text check (featured_title_2 is null or char_length(featured_title_2) <= 200),
  add column if not exists featured_caption_2 text check (featured_caption_2 is null or char_length(featured_caption_2) <= 400),
  add column if not exists featured_source_url_2 text check (featured_source_url_2 is null or char_length(featured_source_url_2) <= 500);

-- Private bucket for the creative direction PDF. Never public: the file is
-- only ever streamed through an artist's token link.
insert into storage.buckets (id, name, public)
values ('rabobank-private', 'rabobank-private', false)
on conflict (id) do nothing;
