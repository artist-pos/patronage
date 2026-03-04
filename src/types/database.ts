export type CountryEnum = "NZ" | "AUS" | "Global";
export type OppTypeEnum =
  | "Grant"
  | "Residency"
  | "Commission"
  | "Open Call"
  | "Prize"
  | "Display";

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
  deadline: string | null;         // ISO date string e.g. "2026-06-30"
  url: string | null;
  funding_amount: number | null;
  funding_range: string | null;    // e.g. "$25,000 – $50,000"
  sub_categories: string[] | null; // e.g. ["Research", "Travel"]
  featured_image_url: string | null;
  grant_type: string | null;
  recipients_count: number | null;
  is_active: boolean;
  status: string;                  // "pending" | "published" | "rejected"
  source_url: string | null;       // page the scraper found this on
  profile_id: string | null;
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

export interface OpportunityFilters {
  type?: OppTypeEnum;
  country?: CountryEnum;
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
  created_at: string;
}

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
  description: string | null;
  is_available: boolean;
  hide_available: boolean;
  hide_from_archive: boolean;
  hide_price: boolean;
  collection_visible: boolean;
  position: number;
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
}

export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  message_type: 'text' | 'transfer_request' | 'transfer_accepted';
  work_id: string | null;
  created_at: string;
}

export interface ProjectUpdate {
  id: string;
  artist_id: string;
  project_id: string | null;
  image_url: string;
  caption: string | null;
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
  unread_count: number;
}
