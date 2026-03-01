-- =============================================================
-- Patronage — Initial Schema
-- Run in: Supabase SQL Editor
-- =============================================================

-- ── Enums ─────────────────────────────────────────────────────

create type country_enum as enum ('NZ', 'AUS', 'Global');
create type role_enum    as enum ('artist', 'admin');
create type stage_enum   as enum ('Emerging', 'Mid-Career', 'Established', 'Open');
create type opp_type_enum as enum (
  'Grant', 'Residency', 'Commission', 'Open Call', 'Prize', 'Display'
);

-- ── Tables ────────────────────────────────────────────────────

-- Profiles (one per auth.users row)
create table profiles (
  id                      uuid primary key references auth.users on delete cascade,
  username                text unique not null,
  full_name               text,
  bio                     text,
  country                 country_enum,
  role                    role_enum not null default 'artist',
  career_stage            stage_enum,
  medium                  text[],
  cv_url                  text,
  avatar_url              text,
  is_active               boolean not null default true,
  is_patronage_supported  boolean not null default false,
  created_at              timestamptz not null default now()
);

-- Opportunities (admin-managed listing board)
create table opportunities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  organiser   text not null,
  description text,
  type        opp_type_enum not null,
  country     country_enum not null,
  deadline    date,
  url         text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Subscribers (email capture, no auth required)
create table subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index on opportunities (deadline);
create index on opportunities (country);
-- profiles.username already has a unique index from the unique constraint

-- ── Row-Level Security ────────────────────────────────────────

alter table profiles     enable row level security;
alter table opportunities enable row level security;
alter table subscribers  enable row level security;

-- Helper: check if caller is an admin
create or replace function is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: public read
create policy "profiles_select_public"
  on profiles for select using (true);

-- profiles: owner can insert their own row
create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

-- profiles: owner or admin can update
create policy "profiles_update_own_or_admin"
  on profiles for update
  using (auth.uid() = id or is_admin());

-- opportunities: public can read active, non-expired opportunities
create policy "opportunities_select_public"
  on opportunities for select
  using (
    is_active = true
    and (deadline is null or deadline >= current_date)
  );

-- opportunities: admin full write access
create policy "opportunities_insert_admin"
  on opportunities for insert
  with check (is_admin());

create policy "opportunities_update_admin"
  on opportunities for update
  using (is_admin());

create policy "opportunities_delete_admin"
  on opportunities for delete
  using (is_admin());

-- subscribers: anyone can subscribe
create policy "subscribers_insert_public"
  on subscribers for insert
  with check (true);

-- subscribers: admin only read / delete
create policy "subscribers_select_admin"
  on subscribers for select
  using (is_admin());

create policy "subscribers_delete_admin"
  on subscribers for delete
  using (is_admin());
