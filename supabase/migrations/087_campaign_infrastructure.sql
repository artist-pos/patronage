-- Migration 087: Campaign Infrastructure (Phase 6B)
-- Tables: campaigns, campaign_files, campaign_email_captures, enquiries
-- Activation fields on opportunities
-- FK from engagement_logs.campaign_id → campaigns(id)

-- ── campaigns ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaigns (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        uuid        REFERENCES opportunities(id) ON DELETE SET NULL,
  artist_profile_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id        uuid        REFERENCES opportunity_applications(id) ON DELETE SET NULL,

  -- Campaign details
  campaign_type         text        NOT NULL CHECK (campaign_type IN (
                                      'hoarding', 'billboard', 'truck_curtain',
                                      'packaging', 'art_fair', 'exhibition', 'other'
                                    )),
  title                 text        NOT NULL,
  slug                  text        NOT NULL,

  -- Physical location
  location_address      text,
  location_lat          numeric,
  location_lng          numeric,
  surface_type          text,

  -- Partner info (null for self-managed)
  partner_name          text,
  partner_profile_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timing & fee
  campaign_start_date   date,
  campaign_end_date     date,
  fee_amount            numeric,

  -- Production
  production_specs      text,
  production_status     text        DEFAULT 'pending'
                                    CHECK (production_status IN (
                                      'pending', 'files_submitted', 'approved',
                                      'in_production', 'live', 'completed', 'archived'
                                    )),

  -- QR and landing page
  qr_code_url           text,
  landing_page_slug     text,
  landing_page_config   jsonb       DEFAULT '{}'::jsonb,

  -- Status state machine
  status                text        DEFAULT 'configuring'
                                    CHECK (status IN (
                                      'configuring', 'awaiting_approval', 'approved',
                                      'live', 'paused', 'completed', 'archived'
                                    )),

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  UNIQUE (slug, artist_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_artist      ON campaigns(artist_profile_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_opportunity ON campaigns(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status      ON campaigns(status);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Artists manage their own campaigns
CREATE POLICY "Artists manage own campaigns"
  ON public.campaigns
  USING (
    artist_profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- Partners can read campaigns linked to their opportunities
CREATE POLICY "Partners read their opportunity campaigns"
  ON public.campaigns FOR SELECT
  USING (
    partner_profile_id = auth.uid()
    OR opportunity_id IN (
      SELECT id FROM opportunities WHERE profile_id = auth.uid()
    )
  );

-- ── campaign_files ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaign_files (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  uploaded_by      uuid        NOT NULL REFERENCES profiles(id),
  file_url         text        NOT NULL,
  file_name        text        NOT NULL,
  file_type        text        CHECK (file_type IN ('production_final', 'proof', 'mockup', 'reference')),
  file_size_bytes  bigint,
  notes            text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign participants can view files"
  ON public.campaign_files FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE artist_profile_id = auth.uid()
        OR partner_profile_id = auth.uid()
        OR opportunity_id IN (SELECT id FROM opportunities WHERE profile_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "Uploaders can insert files"
  ON public.campaign_files FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

-- ── campaign_email_captures ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaign_email_captures (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  source       text        DEFAULT 'qr_landing',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_email_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit email capture"
  ON public.campaign_email_captures FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Campaign owners and admins can read captures"
  ON public.campaign_email_captures FOR SELECT
  USING (
    campaign_id IN (SELECT id FROM campaigns WHERE artist_profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- ── enquiries ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.enquiries (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id           uuid        REFERENCES portfolio_images(id) ON DELETE SET NULL,
  campaign_id       uuid        REFERENCES campaigns(id) ON DELETE SET NULL,
  artist_profile_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type       text        DEFAULT 'profile'
                                CHECK (source_type IN ('qr_landing', 'profile', 'direct')),
  name              text        NOT NULL,
  email             text        NOT NULL,
  message           text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit enquiry"
  ON public.enquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Artists read own enquiries"
  ON public.enquiries FOR SELECT
  USING (
    artist_profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- ── engagement_logs: add FK now that campaigns exists ────────────────────────
-- campaign_id was added as plain uuid in migration 086; add FK constraint now.

ALTER TABLE public.engagement_logs
  ADD CONSTRAINT fk_engagement_campaign
  FOREIGN KEY (campaign_id)
  REFERENCES public.campaigns(id)
  ON DELETE SET NULL;

-- ── opportunities: activation fields ────────────────────────────────────────

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS is_activation          boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS surface_type           text,
  ADD COLUMN IF NOT EXISTS panels_available       integer,
  ADD COLUMN IF NOT EXISTS fee_per_artist         numeric,
  ADD COLUMN IF NOT EXISTS campaign_duration_months integer,
  ADD COLUMN IF NOT EXISTS location_address       text,
  ADD COLUMN IF NOT EXISTS location_lat           numeric,
  ADD COLUMN IF NOT EXISTS location_lng           numeric,
  ADD COLUMN IF NOT EXISTS production_specs       text,
  ADD COLUMN IF NOT EXISTS campaign_start_date    date,
  ADD COLUMN IF NOT EXISTS campaign_end_date      date;
