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
  funding_amount: number | null;
  funding_range: string | null;    // e.g. "$25,000 – $50,000"
  sub_categories: string[] | null; // e.g. ["Research", "Travel"] — disciplines
  tags?: string[] | null;          // freeform searchable tags (eligibility, focus, themes)
  career_stage?: string[] | null;  // career stage tags e.g. ["Emerging", "Mid-Career"]
  featured_image_url: string | null;
  grant_type: string | null;
  recipients_count: number | null;
  slug: string | null;             // SEO-friendly URL segment e.g. "photoplace-gallery-open-call-195878cc"
  is_active: boolean;
  status: string;                  // "pending" | "published" | "rejected"
  source_url: string | null;       // page the scraper found this on
  profile_id: string | null;
  created_at: string;
  // Transparency fields (migration 035)
  entry_fee: number | null;
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
  // Claim tokens (migration 059)
  claim_token: string | null;
  claim_email: string | null;
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
}

// Looser insert type — new optional fields need not be specified for CSV imports
export type OpportunityInsert = Omit<
  Opportunity,
  | "id" | "is_active" | "created_at"
  | "city" | "funding_amount" | "funding_range" | "sub_categories"
  | "featured_image_url" | "grant_type" | "recipients_count"
  | "caption" | "full_description"
> & {
  city?: string | null;
  funding_amount?: number | null;
  funding_range?: string | null;
  sub_categories?: string[] | null;
  featured_image_url?: string | null;
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

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  country: CountryEnum | null;
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
  acquired_works: string[];
  hide_sold_section: boolean;
  collection_public: boolean;
  received_grants: string[];
  marketing_subscription: boolean;
  weekly_digest: boolean;
  support_enabled: boolean;
  disciplines: DisciplineEnum[] | null;
  created_at: string;
}

export type ImageOrientation = 'landscape' | 'portrait' | 'square';

export interface PortfolioImage {
  id: string;
  profile_id: string;
  url: string;
  caption: string | null;
  description: string | null;
  position: number;
  is_available: boolean;
  price: string | null;
  creator_id: string;
  current_owner_id: string;
  hide_from_archive: boolean;
  hide_price: boolean;
  collection_visible: boolean;
  hide_available: boolean;
  is_featured: boolean;
  orientation: ImageOrientation | null;
  natural_width: number | null;
  natural_height: number | null;
  content_type: ContentTypeEnum;
  audio_url: string | null;
  video_url: string | null;
  text_content: string | null;
  title: string | null;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  linked_artwork_id: string | null;
  slug: string | null;
  created_at: string;
}

export interface Artwork {
  id: string;
  profile_id: string;
  creator_id: string;
  current_owner_id: string;
  url: string;
  caption: string | null;
  price: string | null;
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
  dimensions: string | null;
  edition: string | null;
  created_at: string;
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

export interface ProfileFilters {
  country?: CountryEnum;
  career_stage?: CareerStageEnum;
  medium?: string;
  discipline?: DisciplineEnum;
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
  message_type: 'text' | 'transfer_request' | 'transfer_accepted' | 'deletion_request' | 'deletion_accepted' | 'work_offer';
  work_id: string | null;
  offer_amount: number | null;
  offer_currency: string | null;
  is_system_message: boolean;
  source_action: string | null;
  created_at: string;
}

export interface ProjectUpdate {
  id: string;
  artist_id: string;
  project_id: string | null;
  image_url: string | null;
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
  created_at: string;
}

export interface ProjectUpdateWithArtist extends ProjectUpdate {
  artist_username: string;
  artist_full_name: string | null;
  artist_avatar_url: string | null;
}

export interface Project {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
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
}
