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
  type: OppTypeEnum;
  country: CountryEnum;
  deadline: string | null; // ISO date string e.g. "2026-06-30"
  url: string | null;
  funding_amount: number | null;
  featured_image_url: string | null;
  grant_type: string | null;
  recipients_count: number | null;
  is_active: boolean;
  created_at: string;
}

// Looser insert type — new optional fields need not be specified for CSV imports
export type OpportunityInsert = Omit<
  Opportunity,
  "id" | "is_active" | "created_at" | "funding_amount" | "featured_image_url" | "grant_type" | "recipients_count"
> & {
  funding_amount?: number | null;
  featured_image_url?: string | null;
  grant_type?: string | null;
  recipients_count?: number | null;
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
  role: "artist" | "admin";
  career_stage: CareerStageEnum | null;
  medium: string[] | null;
  cv_url: string | null;
  avatar_url: string | null;
  featured_image_url: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  is_active: boolean;
  is_patronage_supported: boolean;
  created_at: string;
}

export interface PortfolioImage {
  id: string;
  profile_id: string;
  url: string;
  caption: string | null;
  position: number;
  created_at: string;
}

export interface ProfileWithImage extends Profile {
  primary_image_url: string | null;
}

export interface ProfileFilters {
  country?: CountryEnum;
  career_stage?: CareerStageEnum;
}
