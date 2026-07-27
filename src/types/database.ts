export type CountryEnum = "NZ" | "AUS" | "Global" | "UK" | "US" | "EU";

export type DisciplineEnum =
  | "visual_art"
  | "music"
  | "poetry"
  | "writing"
  | "dance"
  | "film"
  | "photography"
  | "craft"
  | "performance"
  | "other";

export type ContentTypeEnum = "image" | "audio" | "video" | "text" | "document" | "embed";

export interface CreativeWork {
  id: string;
  profile_id: string;
  creator_id: string;
  current_owner_id: string;
  discipline: DisciplineEnum;
  content_type: ContentTypeEnum;
  title: string | null;
  caption: string | null;
  description: string | null;
  year_created: number | null;
  medium_detail: string | null;
  duration_seconds: number | null;
  image_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  text_content: string | null;
  embed_url: string | null;
  embed_provider: string | null;
  price: string | null;
  is_available: boolean;
  hide_available: boolean;
  hide_from_archive: boolean;
  hide_price: boolean;
  collection_visible: boolean;
  position: number;
  created_at: string;
}
export type OppTypeEnum =
  | "Grant"
  | "Residency"
  | "Commission"
  | "Open Call"
  | "Prize"
  | "Display"
  | "Job / Employment"
  | "Studio / Space"
  | "Public Art";

export interface CustomField {
  id: string;
  question: string;
  inputType: 'short' | 'long' | 'file';
}

export interface PipelineQuestion {
  id: string;
  label: string;
  type: 'short_text' | 'long_text' | 'file_upload' | 'checkbox';
  required: boolean;
  file_label?: string;
}

export interface PipelineConfig {
  questions: PipelineQuestion[];
  artist_documents: ('cv' | 'bio' | 'portfolio' | 'available_works')[];
  terms_pdf_url: string | null;
  /** How many portfolio works the artist may pick when submitting (only used
   *  when 'portfolio' is in artist_documents). Defaults to 3 — matches the
   *  Verified-badge minimum of 3 works in their portfolio. */
  portfolio_pick_count?: number;
  post_selection?: PostSelectionConfig | null;
  notification_defaults?: {
    shortlisted: 'send' | 'hold';
    rejected: 'send' | 'hold';
    selected: 'send' | 'hold';
  };
  anonymous_first_pass?: boolean;
  template?: 'residency' | 'commission' | 'grant' | 'open_call' | 'prize' | 'display';
  /** Which of the 6 system application stages this opportunity uses, in display order.
   *  Unset = all 6 (today's default). "pending" always stays enabled — it's the
   *  status every application starts at. The underlying status values never change;
   *  this only controls which columns/filters show and what they're labelled. */
  pipeline_stages?: {
    enabled: string[];
    labels?: Record<string, string>;
  } | null;
}

export interface PostSelectionDocField {
  id: string;
  label: string;
  type: 'file' | 'link' | 'text' | 'rich_text';
  required: boolean;
  description?: string;
}

export interface PostSelectionConfig {
  requires_campaign: boolean;
  requires_studio_updates: boolean;
  update_frequency_days: 7 | 14 | 30 | 90 | null;
  requires_documentation: boolean;
  doc_fields: PostSelectionDocField[];
}

export interface ApplicationLink {
  label: string;
  url: string;
}

export interface Opportunity {
  id: string;
  title: string;
  organiser: string;
  description: string | null;
  caption: string | null;          // short summary ≤160 chars, shown on card
  full_description: string | null; // expanded detail, revealed via accordion
  type: OppTypeEnum;
  country: string;                 // "NZ" | "AUS" | "Global" | "UK" | "US" | "EU" etc.
  city: string | null;             // free-text e.g. "Auckland" or "Multiple Locations"
  opens_at: string | null;         // ISO date when applications open e.g. "2026-05-01"
  deadline: string | null;         // ISO date string e.g. "2026-06-30"
  url: string | null;
  application_links?: ApplicationLink[] | null; // labelled apply links → buttons (migration 164)
  contact_email?: string | null;
  funding_amount: number | null;
  funding_range: string | null;    // e.g. "$25,000 – $50,000"
  sub_categories: string[] | null; // e.g. ["Research", "Travel"] — disciplines
  tags?: string[] | null;          // freeform searchable tags (eligibility, focus, themes)
  career_stage?: string[] | null;  // career stage tags e.g. ["Emerging", "Mid-Career"]
  featured_image_url: string | null;
  secondary_image_url: string | null; // optional second hero image (migration 173) — detail page carousel only
  grant_type: string | null;
  recipients_count: number | null;
  slug: string | null;             // SEO-friendly URL segment e.g. "photoplace-gallery-open-call-195878cc"
  is_active: boolean;
  status: string;                  // "pending" | "published" | "rejected"
  source_url: string | null;       // page the scraper found this on
  profile_id: string | null;
  created_at: string;
  // Transparency fields (migration 035)
  entry_fee: number | null;          // always NZD equivalent
  entry_fee_currency: string | null; // ISO 4217 code (migration 075), null = NZD
  entry_fee_local: number | null;    // original amount in entry_fee_currency (migration 075)
  artist_payment_type: string | null;
  travel_support: boolean | null;
  travel_support_details: string | null;
  view_count: number;
  // Application routing (migration 035)
  routing_type: 'external' | 'pipeline';
  custom_fields: CustomField[];
  show_badges_in_submission: boolean;
  // Paid placement (migration 042)
  is_featured: boolean;
  // Pipeline application config (migration 053)
  pipeline_config?: PipelineConfig | null;
  // Recurring schedule (migration 058)
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_open_day: number | null;   // day-of-month e.g. 1
  recurrence_close_day: number | null;  // day-of-month e.g. 15
  recurrence_end_date: string | null;   // ISO date or null = indefinite
  // Claim tokens (migration 059 / 067)
  claim_token: string | null;
  claim_email: string | null;
  claim_token_expires_at: string | null;
  // Claim invite tracking (migration 090)
  claim_invite_sent_at: string | null;
  claim_invite_email: string | null;
  claim_invite_scheduled_for: string | null;
  claim_invite_template: 'claim_only' | 'claim_pipeline' | null;
  claim_link_opened_at: string | null;
  claim_link_open_count: number;
  // Scraper confidence (migration 091)
  confidence?: 'high' | 'medium' | 'low' | null;
  // Phase 7.5c — partner-side commerce flags (migration 112)
  pipeline_paid_at?: string | null;
  featured_until?: string | null;
}

export type RecurrencePattern =
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'biannual'
  | 'annual'
  | 'custom';

export interface SavedOpportunity {
  id: string;
  user_id: string;
  opportunity_id: string;
  status: 'saved' | 'applied';
  created_at: string;
}

export interface OpportunityApplication {
  id: string;
  opportunity_id: string;
  artist_id: string;
  status: 'pending' | 'shortlisted' | 'selected' | 'approved_pending_assets' | 'production_ready' | 'rejected';
  custom_answers: Record<string, string>;
  artwork_id: string | null;
  submitted_image_url: string | null;
  highres_asset_url: string | null;
  created_at: string;
  rejection_reason: string | null;
  rejection_reply_sent_at: string | null;
  invoice_requested_at: string | null;
  invoice_amount: number | null;
  invoice_paid_at: string | null;
  creative_work_id: string | null;
  /** Multiple portfolio picks (Step 3 "Portfolio images" with a pick count > 1).
   *  creative_work_id above stays as the first pick, for older single-work consumers. */
  creative_work_ids: string[] | null;
}

export interface RubricCriterion {
  id: string;
  opportunity_id: string;
  label: string;
  helper: string | null;
  weight: number;
  scale_max: 3 | 5 | 10;
  position: number;
  locked: boolean;
  created_at: string;
}

export interface ApplicationScore {
  id: string;
  application_id: string;
  criterion_id: string;
  reviewer_id: string;
  score: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'sale' | 'support' | 'transfer_request' | 'transfer_accepted' | 'note';
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationQueueItem {
  id: string;
  opportunity_id: string;
  application_id: string;
  recipient_id: string;
  notification_type: 'shortlisted' | 'rejected' | 'selected' | 'approved_pending_assets';
  email_subject: string | null;
  email_body: string | null;
  status: 'queued' | 'sent' | 'cancelled';
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface PartnerDocument {
  id: string;
  opportunity_id: string;
  label: string;
  storage_path: string;
  file_size_kb: number | null;
  uploaded_by: string | null;
  created_at: string;
}

// Looser insert type — new optional fields need not be specified for CSV imports
export type OpportunityInsert = Omit<
  Opportunity,
  | "id" | "is_active" | "created_at"
  | "city" | "funding_amount" | "funding_range" | "sub_categories"
  | "featured_image_url" | "secondary_image_url" | "grant_type" | "recipients_count"
  | "caption" | "full_description"
> & {
  city?: string | null;
  funding_amount?: number | null;
  funding_range?: string | null;
  sub_categories?: string[] | null;
  featured_image_url?: string | null;
  secondary_image_url?: string | null;
  grant_type?: string | null;
  recipients_count?: number | null;
  caption?: string | null;
  full_description?: string | null;
};

export interface OpportunityApplicationDraft {
  id: string;
  opportunity_id: string;
  artist_id: string;
  artwork_id: string | null;
  submitted_image_url: string | null;
  custom_answers: Record<string, string>;
  updated_at: string;
  creative_work_id: string | null;
  creative_work_ids: string[] | null;
}

export interface ProfileAchievement {
  id: string;
  profile_id: string;
  opportunity_id: string | null;
  opportunity_title: string;
  organisation: string;
  type: string;
  year: number;
  verified: boolean;
  created_at: string;
}

export interface OpportunityFilters {
  type?: OppTypeEnum;
  country?: CountryEnum;
  discipline?: string;
  freeEntry?: boolean;
  eligibility?: string;
  careerStage?: string;
  search?: string;
}

export type CareerStageEnum = "Emerging" | "Mid-Career" | "Established" | "Open";

export type OrganisationType = "charity" | "gallery" | "business";

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  country: CountryEnum | null;
  city: string | null;
  role: "artist" | "admin" | "owner" | "patron" | "partner";
  career_stage: CareerStageEnum | null;
  medium: string[] | null;
  cv_url: string | null;
  professional_cv_url: string | null;
  avatar_url: string | null;
  featured_image_url: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  banner_focus_y: number;
  exhibition_history: ExhibitionEntry[];
  press_bibliography: BibliographyEntry[];
  is_active: boolean;
  is_patronage_supported: boolean;
  is_spotlight: boolean;
  acquired_works: string[];
  hide_sold_section: boolean;
  collection_public: boolean;
  // Phase 4 — granular profile privacy toggles (migration 108)
  show_taste: boolean;
  show_follows: boolean;
  show_location: boolean;
  show_previously_collected: boolean;
  show_supporting: boolean;
  // Phase 6 — partner differentiation (migration 109)
  organisation_type: OrganisationType | null;
  charitable_registration: string | null;
  donation_enabled: boolean;
  donation_url: string | null;
  received_grants: string[];
  marketing_subscription: boolean | null;
  weekly_digest: boolean | null;
  support_enabled: boolean;
  // Migration 167: commission availability status + blurb
  open_for_commissions: boolean;
  commission_info: string | null;
  // Migration 168: admin-set featured artist (latest unexpired date wins)
  spotlight_until: string | null;
  // Migration 170: patron identity masked on the public profile ("donor wall"
  // stays, name/bio/collection hidden; Following list remains public)
  private_supporter: boolean;
  disciplines: DisciplineEnum[] | null;
  // Demographic fields — internal only, never shown on public profile
  year_of_birth: number | null;
  identity_tags: string[];
  // Provenance branding (migration 098)
  provenance_logo_url: string | null;
  provenance_signature_url: string | null;
  provenance_template_theme: 'minimal' | 'editorial' | 'gallery';
  account_status: 'active' | 'shadow';
  // Migration 052: embed display configuration for patron collection embeds
  patron_embed_config: Record<string, unknown> | null;
  created_at: string;
  // Gallery layout preferences (migration 115)
  gallery_row_height: number;
  gallery_gutter: number;
  // Works feed layout — admin-controlled global setting (migration 116)
  works_row_height: number;
  works_h_gap: number;
  works_v_gap: number;
  works_last_row_align: "left" | "center" | "right";
  // Stripe Connect — added by migration 120 (Phase 1)
  stripe_account_id: string | null;
  stripe_connect_status: 'pending' | 'enabled' | 'restricted' | null;
  // Payment profile (migration 053)
  gst_registered: boolean;
  gst_number: string | null;
  // Blog card visibility (migration 156)
  hide_blog_card: boolean;
}

export interface ArtistFollowup {
  id: string;
  profile_id: string;
  opportunity_id: string;
  application_id: string;
  followup_type: '6_month' | '12_month';
  sent_at: string | null;
  completed_at: string | null;
  further_opportunities: string | null;
  exhibitions: string | null;
  press_coverage: string | null;
  income_from_practice: 'Increased' | 'Stayed the same' | 'Decreased' | 'Not applicable' | null;
  community_projects: string | null;
  testimonial: string | null;
  testimonial_consent: boolean;
  additional_notes: string | null;
  created_at: string;
}

export type ImageOrientation = 'landscape' | 'portrait' | 'square';

/** @deprecated — use Artwork. Kept as an alias during the migration 135 sweep. */
export type PortfolioImage = Artwork;

export type SupportTierType = "one_off" | "recurring" | "service" | "project";

export interface SupportTier {
  id: string;
  profile_id: string;
  title: string;
  price: number;
  description: string | null;
  tier_type: SupportTierType | null;
  sort_order: number;
  is_active: boolean;
  // Phase 7.5d (migration 113) — Stripe IDs are minted lazily on first checkout
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  tier_image_url: string | null;
  created_at: string;
}

export interface Collective {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface CollectiveMember {
  id: string;
  collective_id: string;
  user_id: string;
  role: "admin" | "member";
  status: "pending" | "accepted";
  joined_at: string;
  collective?: Collective;
}

export interface CollectiveEmailInvitation {
  id: string;
  collective_id: string;
  email: string;
  token: string;
  invited_by: string;
  claimed_by: string | null;
  created_at: string;
  expires_at: string;
  collective?: Collective;
}

export type ArtworkSource = 'self_registered' | 'holder_uploaded';

export interface Artwork {
  id: string;
  profile_id: string;
  creator_id: string;
  current_owner_id: string;
  url: string;
  /** Pre-generated ~800px thumbnail for grids; full `url` is used in detail/lightbox. */
  thumb_url?: string | null;
  caption: string | null;
  price_cents: number | null;
  is_poa: boolean;
  price_parse_failed: boolean;
  price_currency: 'NZD' | 'AUD';
  description: string | null;
  is_available: boolean;
  hide_available: boolean;
  hide_from_archive: boolean;
  hide_price: boolean;
  collection_visible: boolean;
  collection_label: string | null;
  hidden_from_artist: boolean;
  position: number;
  title: string | null;
  year: number | null;
  medium: string | null;
  medium_category: string[] | null;
  surface_or_substrate: string | null;
  dimensions: string | null;
  edition: string | null;
  // Structured edition fields (migration 110)
  edition_number: number | null;
  edition_total: number | null;
  edition_type: 'unique' | 'limited' | 'open' | 'AP' | 'proof' | null;
  // Provenance (migration 098)
  ledger_id: string | null;
  certificate_note: string | null;
  // Vault — collection vault (migration 105)
  source: ArtworkSource;
  attributed_artist_text: string | null;
  attributed_artist_id: string | null;
  // Phase 2: stub link when the attributed artist isn't on Patronage yet (migration 106)
  attributed_pending_artist_id: string | null;
  // Migration 114: controls whether a Buy button or Enquire button is shown
  listing_mode: 'direct_sale' | 'enquire_first';
  // Migration 052: single CTA mode on the artwork detail page
  acquisition_mode: 'buy_now' | 'make_offer' | 'enquire_first';
  // Migration 052: physical dimensions for justified grid aspect-ratio calculation
  width_mm: number | null;
  height_mm: number | null;
  // Migration 135: unified from portfolio_images
  slug: string | null;
  collaborator_ids: string[];
  // Edition provenance — clone of parent artwork at sale time
  parent_artwork_id: string | null;
  content_type: ContentTypeEnum;
  audio_url: string | null;
  video_url: string | null;
  text_content: string | null;
  embed_url: string | null;
  embed_provider: string | null;
  is_featured: boolean;
  orientation: ImageOrientation | null;
  natural_width: number | null;
  natural_height: number | null;
  location_text: string | null;
  show_location_publicly: boolean;
  created_at: string;
}

export type CollectionSourceType =
  | 'directly_from_artist'
  | 'gallery'
  | 'auction'
  | 'gift'
  | 'inheritance'
  | 'other';

export interface CollectionMembership {
  id: string;
  holder_id: string;
  artwork_id: string;
  is_public: boolean;
  position: number;
  group_id: string | null;
  date_acquired_text: string | null;
  source_type: CollectionSourceType | null;
  source_name: string | null;
  price_paid_amount: number | null;
  price_paid_currency: string | null;
  location_text: string | null;
  show_location_publicly: boolean;
  certificate_statement: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionGroup {
  id: string;
  holder_id: string;
  name: string;
  position: number;
  created_at: string;
}

export type ArtworkSourceDocumentType = 'certificate' | 'invoice' | 'receipt' | 'other';

export interface ArtworkSourceDocument {
  id: string;
  artwork_id: string;
  uploaded_by: string;
  storage_path: string;
  document_type: ArtworkSourceDocumentType;
  description: string | null;
  created_at: string;
}

export interface ArtworkProvenanceLedger {
  id: string;
  artwork_id: string;
  ledger_id: string;
  entry_type: 'created' | 'transferred' | 'resold' | 'selected';
  from_owner_id: string | null;
  to_owner_id: string;
  transfer_method: 'listing' | 'stripe' | 'claim' | 'direct' | 'negotiated_sale' | 'gift';
  transaction_ref: string | null;
  price: number | null;
  transferred_at: string;
  certificate_url: string | null;
  notes: string | null;
  campaign_id: string | null;
  // Migration 052: links a 'selected' entry to the opportunity that caused selection
  source_opportunity_id: string | null;
}

export interface PendingOwnershipClaim {
  id: string;
  artwork_id: string;
  claimer_name: string;
  claimer_email: string;
  status: 'pending' | 'approved' | 'declined';
  claimed_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

// ── Phase 2: holder-uploaded attribution + artist confirmation loop ──

export type OutreachStatus = 'unattempted' | 'emailed' | 'phoned' | 'unreachable';

export interface PendingArtist {
  id: string;
  name: string;
  name_normalised: string;
  email: string | null;
  claim_token: string;
  created_by_holder_id: string | null;
  claim_invite_sent_at: string | null;
  claim_invite_email: string | null;
  claim_link_opened_at: string | null;
  claim_link_open_count: number;
  last_outreach_at: string | null;
  outreach_status: OutreachStatus | null;
  outreach_notes: string | null;
  claimed_by_profile_id: string | null;
  claimed_at: string | null;
  created_at: string;
}

export type AttributionClaimStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'unknown'
  | 'resolved_by_patronage';

export interface HolderAttributionClaim {
  id: string;
  artwork_id: string;
  holder_id: string;
  target_profile_id: string | null;
  target_pending_artist_id: string | null;
  status: AttributionClaimStatus;
  decline_reason: string | null;
  decline_appealed_at: string | null;
  decline_appeal_evidence: string | null;
  decline_appeal_message: string | null;
  resolved_by_admin_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Grant {
  id: string;
  profile_id: string;
  title: string;
  organiser: string | null;
  amount_cents: number | null;
  currency: string;
  year: number | null;
  notes: string | null;
  opportunity_id: string | null;
  project_id: string | null;
  created_at: string;
}

export type ResaleStatus = 'pending' | 'paid' | 'reverted';
export type ResalePayoutStatus = 'owed' | 'paid' | 'cancelled';
export type ResaleRoyaltyStatus = 'pending' | 'paid_to_artist' | 'held' | 'refunded_to_seller';

export interface ResaleTransaction {
  id: string;
  artwork_id: string;
  seller_id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  sale_price_cents: number;
  currency: string;
  patronage_commission_cents: number;
  artist_royalty_cents: number;
  buyer_paid_total_cents: number;
  status: ResaleStatus;
  seller_payout_status: ResalePayoutStatus;
  royalty_status: ResaleRoyaltyStatus;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  paid_at: string | null;
  reverted_at: string | null;
  reverted_reason: string | null;
  created_at: string;
}

export type RoyaltyHoldStatus = 'held' | 'paid' | 'refunded_to_seller';

export interface RoyaltyHold {
  id: string;
  resale_transaction_id: string;
  artwork_id: string;
  artist_profile_id: string | null;
  artist_pending_id: string | null;
  artist_name_text: string | null;
  amount_cents: number;
  currency: string;
  status: RoyaltyHoldStatus;
  outreach_count: number;
  last_outreach_at: string | null;
  expires_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  paid_via_note: string | null;
  created_at: string;
}

export interface NegotiatedSaleTransaction {
  id: string;
  artwork_id: string;
  artist_id: string;
  buyer_id: string | null;
  buyer_email: string;
  conversation_id: string;
  sale_price_cents: number;
  currency: string;
  patronage_commission_cents: number;
  buyer_paid_total_cents: number;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  status: 'pending' | 'paid';
  artist_payout_status: 'owed' | 'paid';
  paid_at: string | null;
  created_at: string;
}

export type SupportSubscriptionStatus =
  | 'pending'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'one_off_paid'
  | 'reverted';

export interface SupportSubscription {
  id: string;
  tier_id: string;
  recipient_id: string;
  supporter_id: string | null;
  supporter_email: string;
  supporter_name: string | null;
  amount_cents: number;
  currency: string;
  patronage_commission_cents: number;
  buyer_paid_total_cents: number;
  tier_type: 'one_off' | 'recurring';
  status: SupportSubscriptionStatus;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  started_at: string | null;
  canceled_at: string | null;
  created_at: string;
}

export interface PartnerPayment {
  id: string;
  opportunity_id: string;
  partner_id: string;
  amount_cents: number;
  currency: string;
  status: ResaleStatus;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PipelineEntryPayment extends PartnerPayment {}

export interface FeaturedListingPayment extends PartnerPayment {
  feature_days: number;
  feature_until: string | null;
}

export interface PrimarySaleTransaction {
  id: string;
  artwork_id: string;
  artist_id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  sale_price_cents: number;
  currency: string;
  patronage_commission_cents: number;
  buyer_paid_total_cents: number;
  status: ResaleStatus;
  artist_payout_status: ResalePayoutStatus;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  paid_at: string | null;
  reverted_at: string | null;
  reverted_reason: string | null;
  reverted_by: string | null;
  edition_id: string | null;
  created_at: string;
}

export type ArtworkEditionType = 'unique' | 'limited' | 'open' | 'AP' | 'proof';

export type ArtworkTrustTier =
  | 'recorded_by_artist'
  | 'recorded_by_holder'
  | 'confirmed_by_artist'
  | 'resolved_by_patronage'
  | 'disputed';

export type ClaimTokenKind = 'opportunity' | 'provenance' | 'artist';

export interface ClaimTokenRow {
  token_kind: ClaimTokenKind;
  source_id: string;
  claim_token: string;
  subject_label: string;
  subject_detail: string | null;
  contact_email: string | null;
  invite_sent_at: string | null;
  link_opened_at: string | null;
  link_open_count: number;
  last_outreach_at: string | null;
  outreach_status: OutreachStatus | null;
  outreach_notes: string | null;
  is_claimed: boolean;
  created_at: string;
}

// ── Editions model ────────────────────────────────────────────────────────────

export type EditionType = 'original' | 'limited_edition' | 'open_edition' | 'product';
export type EditionListingMode = 'direct' | 'enquire';

export interface Edition {
  id: string;
  work_id: string;
  type: EditionType;
  label: string;
  edition_size: number | null;
  edition_number: number | null;
  dimensions: string | null;
  substrate: string | null;
  price_cents: number | null;
  currency: string;
  poa: boolean;
  listing_mode: EditionListingMode;
  listed: boolean;
  inventory: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WorkImage {
  id: string;
  portfolio_image_id: string | null;
  artwork_id: string | null;
  url: string;
  caption: string | null;
  position: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProvenanceLink {
  id: string;
  artwork_id: string;
  artist_id: string;
  patron_id: string | null;
  patron_email: string | null;
  claim_token: string;
  status: 'invited' | 'pending' | 'verified';
  created_at: string;
}

export interface ProfileWithImage extends Profile {
  primary_image_url: string | null;
}

export interface ExhibitionEntry {
  type: "Solo" | "Group";
  title: string;
  venue: string;
  location: string;
  year: number;
}

export interface BibliographyEntry {
  type: "Review" | "Interview" | "Feature" | "Essay" | "Article";
  author: string;
  title: string;
  publication: string;
  date: string;
  link: string;
}

export interface OpportunityMatch {
  artist_id: string;
  opportunity_id: string;
  score: number;
  reason: string | null;
  scored_at: string;
}

export type OpportunityWithMatch = Opportunity & {
  match_score?: number;
  match_reason?: string | null;
};

export interface ProfileFilters {
  country?: CountryEnum;
  career_stage?: CareerStageEnum;
  medium?: string;
  discipline?: DisciplineEnum;
  openForCommissions?: boolean;
}

export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  initiated_via_enquiry: boolean;
  source_action: string | null;
  source_work_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  message_type: 'text' | 'transfer_request' | 'transfer_accepted' | 'deletion_request' | 'deletion_accepted' | 'work_offer' | 'tag_notification';
  work_id: string | null;
  offer_amount: number | null;
  offer_currency: string | null;
  is_system_message: boolean;
  source_action: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ProjectUpdate {
  id: string;
  artist_id: string;
  project_id: string | null;
  image_url: string | null;
  /** Pre-generated ~480px thumbnail for grids/carousels; full `image_url` is used in detail. */
  thumb_url?: string | null;
  caption: string | null;
  content_type: ContentTypeEnum;
  discipline: DisciplineEnum | null;
  audio_url: string | null;
  video_url: string | null;
  text_content: string | null;
  embed_url: string | null;
  embed_provider: string | null;
  orientation: ImageOrientation | null;
  image_width: number | null;
  image_height: number | null;
  collaborator_ids: string[];
  // Migration 052: tag and optional heading for project thread display
  update_tag: 'concept' | 'update' | 'milestone' | 'complete';
  title: string | null;
  tldr: string | null;
  created_at: string;
}

export interface CollaboratorProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ProjectUpdateWithArtist extends ProjectUpdate {
  artist_username: string;
  artist_full_name: string | null;
  artist_avatar_url: string | null;
  collaborators: CollaboratorProfile[];
}

export interface Project {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  // Migration 052: links project to the opportunity and artwork it relates to
  opportunity_id: string | null;
  artwork_id: string | null;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  update_id: string;
  artist_id: string;
  sender_id: string;
  content: string;
  is_visible: boolean;
  created_at: string;
}

export interface NoteWithSender extends ProjectNote {
  sender_name: string;
  sender_username: string;
  sender_avatar_url: string | null;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface ConversationWithOther {
  id: string;
  other_user_id: string;
  other_username: string;
  other_full_name: string | null;
  other_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  conv_created_at: string;
  unread_count: number;
  source_work_id: string | null;
  source_work_caption: string | null;
}

export interface OpportunityCollaborator {
  id: string;
  opportunity_id: string;
  profile_id: string;
  role: "viewer" | "editor";
  invited_by: string | null;
  invited_at: string;
  // Joined
  profile?: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  inviter?: {
    username: string;
    full_name: string | null;
  } | null;
}

// ── Migration 052: Community chat ────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  body: string | null;
  attachment_type: 'studio_update' | null;
  attachment_id: string | null;
  attachment_meta: {
    title: string;
    project_title: string;
    artist_name: string;
  } | null;
  created_at: string;
}

// ── Migration 052: Embed config type ─────────────────────────────────────────

export interface PatronEmbedConfig {
  row_height: number;
  gap_h: number;
  gap_v: number;
  show_title: boolean;
  show_artist: boolean;
  show_year: boolean;
  show_medium: boolean;
  show_trust: boolean;
  theme: 'light' | 'dark' | 'transparent';
  bg_color: string;
}

export const DEFAULT_EMBED_CONFIG: PatronEmbedConfig = {
  row_height: 200,
  gap_h: 6,
  gap_v: 6,
  show_title: true,
  show_artist: true,
  show_year: false,
  show_medium: false,
  show_trust: true,
  theme: 'light',
  bg_color: '#fafaf8',
};

// ── Artwork Series ────────────────────────────────────────────────────────────

export interface Series {
  id: string;
  artist_id: string;
  title: string;
  slug: string;
  hero_image_url: string | null;
  description: string | null;
  is_featured: boolean;
  created_at: string;
}

export interface SeriesArtwork {
  series_id: string;
  artwork_id: string;
  position: number;
}

export interface SeriesListItem {
  id: string;
  title: string;
  slug: string;
  hero_image_url: string | null;
  artworkCount: number;
  is_featured: boolean;
}

export interface SeriesWork {
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
  medium: string | null;
  year: number | null;
  dimensions: string | null;
  slug: string | null;
  is_available: boolean;
  price_cents: number | null;
  is_poa: boolean;
  price_currency: 'NZD' | 'AUD';
  hide_price: boolean;
  acquisition_mode: 'buy_now' | 'make_offer' | 'enquire_first' | null;
  listing_mode: 'direct_sale' | 'enquire_first' | null;
  position: number;
  editions: SeriesEditionOption[];
}

export interface SeriesEditionOption {
  id: string;
  label: string;
  type: EditionType;
  price_cents: number | null;
  currency: string;
  poa: boolean;
  listing_mode: EditionListingMode;
  listed: boolean;
  dimensions: string | null;
  sort_order: number;
}

export interface SeriesWithWorks extends Series {
  artworks: SeriesWork[];
}

// ── Outreach CRM (migration 150) ──────────────────────────────────────────────

export type OutreachCategory =
  | 'corporate' | 'council_govt' | 'arts_sector' | 'education'
  | 'developer' | 'investor' | 'media_platform' | 'other';

export type OutreachContactStatus =
  | 'not_started' | 'contacted' | 'no_response' | 'replied'
  | 'meeting_booked' | 'in_conversation' | 'rejected' | 'completed' | 'paused' | 'bounced';

export type OutreachChannel =
  | 'email' | 'linkedin' | 'phone' | 'in_person'
  | 'contact_form' | 'intro_email' | 'instagram' | 'other';

export type OutreachSentFrom = 'personal' | 'patronage';

export type OutreachActivityType =
  | 'email_sent' | 'email_received' | 'meeting' | 'phone_call'
  | 'linkedin_message' | 'note' | 'status_change';

export interface OutreachContact {
  id: string;
  company: string;
  contact_name: string | null;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  category: OutreachCategory;
  status: OutreachContactStatus;
  channel: OutreachChannel | null;
  warm_intro_via: string | null;
  first_contact_date: string | null;
  last_activity_date: string | null;
  follow_up_date: string | null;
  meeting_date: string | null;
  their_response: string | null;
  next_action: string | null;
  notes: string | null;
  sent_from: OutreachSentFrom;
  created_at: string;
  updated_at: string;
}

export interface OutreachActivity {
  id: string;
  contact_id: string;
  activity_type: OutreachActivityType;
  description: string;
  created_at: string;
}

// ── Claim tokens (migration 151) ──────────────────────────────────────────────

export type ClaimEntityType = 'partner' | 'artist';
export type ClaimTokenStatus = 'pending' | 'sent' | 'claimed' | 'expired';

export interface ClaimToken {
  id: string;
  token: string;
  entity_type: ClaimEntityType;
  entity_id: string;
  recipient_email: string | null;
  recipient_name: string | null;
  status: ClaimTokenStatus;
  sent_at: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  expires_at: string | null;
  outreach_contact_id: string | null;
  notes: string | null;
  created_at: string;
}
