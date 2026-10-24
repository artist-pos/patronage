-- Rabobank Te Puke pilot, phase 3: invited artists respond (quote) and make a
-- profile for staff. Same access model as 209/210: RLS on, no policies, so only
-- service-role server code can read or write any of this.

-- One row per invited artist. The token is the whole credential for their page,
-- kept raw (unlike survey tokens) so the admin can copy the link again at any time.
create table if not exists public.rabobank_artist_invite (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) between 40 and 64),
  first_name text not null check (char_length(first_name) <= 60),
  full_name text check (full_name is null or char_length(full_name) <= 120),
  email text check (email is null or char_length(email) <= 200),
  instagram_handle text check (instagram_handle is null or char_length(instagram_handle) <= 60),
  channel text not null default 'email' check (channel in ('email', 'instagram')),
  why_paragraph text check (why_paragraph is null or char_length(why_paragraph) <= 1500),
  featured_image_url text check (featured_image_url is null or char_length(featured_image_url) <= 500),
  featured_title text check (featured_title is null or char_length(featured_title) <= 200),
  featured_caption text check (featured_caption is null or char_length(featured_caption) <= 400),
  featured_source_url text check (featured_source_url is null or char_length(featured_source_url) <= 500),
  site_url text check (site_url is null or char_length(site_url) <= 500),
  artist_id uuid references public.rabobank_artist(id) on delete set null,
  invited_at timestamptz,
  opened_at timestamptz,
  opened_source text check (opened_source is null or char_length(opened_source) <= 20),
  opens_email integer not null default 0,
  opens_instagram integer not null default 0,
  opens_other integer not null default 0,
  last_activity_at timestamptz,
  part_one_submitted_at timestamptz,
  part_two_submitted_at timestamptz,
  declined_at timestamptz,
  decline_suggestion text check (decline_suggestion is null or char_length(decline_suggestion) <= 600),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.rabobank_artist_invite enable row level security;

-- Part one. A project record: kept even when a profile is deleted.
create table if not exists public.rabobank_quote (
  invite_id uuid primary key references public.rabobank_artist_invite(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  interested text check (interested in ('yes', 'yes_with_questions', 'no')),
  questions_text text check (questions_text is null or char_length(questions_text) <= 800),
  deliver_by text check (deliver_by in ('yes', 'date')),
  deliver_date date,
  work_type text check (work_type in ('new', 'existing', 'either')),
  existing_work_images text[] not null default '{}' check (cardinality(existing_work_images) <= 2),
  approach_text text check (approach_text is null or char_length(approach_text) <= 700),
  fee_1800x900 numeric(12, 2) check (fee_1800x900 is null or fee_1800x900 > 0),
  fee_1600x800 numeric(12, 2) check (fee_1600x800 is null or fee_1600x800 > 0),
  gst_inclusive boolean,
  alt_size_note text check (alt_size_note is null or char_length(alt_size_note) <= 500),
  framing_option text check (framing_option in ('self', 'other', 'unsure')),
  framing_cost numeric(12, 2) check (framing_cost is null or framing_cost >= 0),
  framing_recommendation text check (framing_recommendation is null or char_length(framing_recommendation) <= 300),
  install_option text check (install_option in ('self', 'other', 'unsure')),
  install_cost numeric(12, 2) check (install_cost is null or install_cost >= 0),
  install_recommendation text check (install_recommendation is null or char_length(install_recommendation) <= 300),
  based_in text check (based_in is null or char_length(based_in) <= 120),
  lead_time_weeks integer check (lead_time_weeks is null or (lead_time_weeks between 0 and 104)),
  anything_else text check (anything_else is null or char_length(anything_else) <= 1000),
  -- Autosave lands here, so edits after submitting don't silently change the
  -- submitted quote. Submitting copies it into the columns above.
  draft jsonb,
  draft_saved_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rabobank_quote enable row level security;

-- Every submit is kept; the latest row in rabobank_quote is what counts.
create table if not exists public.rabobank_quote_version (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.rabobank_artist_invite(id) on delete cascade,
  data jsonb not null,
  submitted_at timestamptz not null default now()
);

alter table public.rabobank_quote_version enable row level security;
create index if not exists rabobank_quote_version_invite_idx on public.rabobank_quote_version (invite_id, submitted_at desc);

-- Part two reuses the shortlist card (rabobank_artist) and its works, so the
-- staff page reads artist profiles with no new query path. `visible` stays the
-- shortlist flag. Manually added artists leave all of these null.
alter table public.rabobank_artist
  add column if not exists invite_id uuid unique references public.rabobank_artist_invite(id) on delete set null,
  add column if not exists photo_url text check (photo_url is null or char_length(photo_url) <= 500),
  add column if not exists bio text check (bio is null or char_length(bio) <= 1500),
  add column if not exists instagram text check (instagram is null or char_length(instagram) <= 60),
  add column if not exists other_links text check (other_links is null or char_length(other_links) <= 500),
  add column if not exists staff_prompt_answer text check (staff_prompt_answer is null or char_length(staff_prompt_answer) <= 500),
  add column if not exists visibility_choice text check (visibility_choice in ('keep', 'private_only')),
  add column if not exists consent_version text check (consent_version is null or char_length(consent_version) <= 40),
  add column if not exists consent_at timestamptz,
  add column if not exists state text check (state in ('draft', 'complete', 'kept', 'private_only', 'deleted')),
  add column if not exists followup_sent_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists kept_profile_id uuid;

alter table public.rabobank_work
  add column if not exists note text check (note is null or char_length(note) <= 500);

alter table public.rabobank_settings
  add column if not exists artist_deadline_at timestamptz,
  add column if not exists selection_closed_at timestamptz,
  add column if not exists framer_quote_1800x900 numeric(12, 2) check (framer_quote_1800x900 is null or framer_quote_1800x900 >= 0),
  add column if not exists framer_quote_1600x800 numeric(12, 2) check (framer_quote_1600x800 is null or framer_quote_1600x800 >= 0),
  add column if not exists staff_see_quotes boolean not null default false;

-- That a profile was deleted, and why. No profile content is kept here.
create table if not exists public.rabobank_deletion_log (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null,
  invite_id uuid,
  reason text not null check (reason in ('no_reply', 'artist_request', 'admin')),
  deleted_at timestamptz not null default now()
);

alter table public.rabobank_deletion_log enable row level security;
