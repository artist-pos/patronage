import type { CustomField, PipelineConfig } from "@/types/database";

// Named for the legacy creative_work_ids column, but these rows come from
// `artworks` (the portfolio picker sources from there, not creative_works —
// see ApplyButton.tsx) — always images, no content_type/embed variants.
export interface CreativeWorkLite {
  id: string;
  title: string | null;
  caption: string | null;
  url: string;
  thumb_url: string | null;
  /** The artist's own description of the work. Shown to reviewers unless this
   *  application carries an override in `work_descriptions`. */
  description: string | null;
}

export interface StatusLogEntry {
  id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  changed_by_name: string | null;
}

export interface EnrichedApp {
  id: string;
  status: string;
  created_at: string;
  artwork: { id: string; url: string; caption: string | null; description: string | null } | null;
  submitted_image_url: string | null;
  /** First image from a file-upload question answer (e.g. a concept sketch) —
   *  the actual submission for this opportunity, prioritised over portfolio
   *  picks for card thumbnails since it's opportunity-specific. */
  concept_image_url: string | null;
  /** All portfolio works the artist picked (Step 3 "Portfolio images" pick count). */
  creative_works: CreativeWorkLite[] | null;
  /** Descriptions the artist wrote for THIS application, keyed by artwork id
   *  (migration 178). An absent key means the work's own description stands. */
  work_descriptions: Record<string, string>;
  custom_answers: Record<string, string>;
  highres_asset_url: string | null;
  /** What the artist currently sees. Null until results are published. */
  released_status?: string | null;
  documentation?: Record<string, string> | null;
  invoice_requested_at?: string | null;
  invoice_amount?: number | null;
  invoice_paid_at?: string | null;
  status_log?: StatusLogEntry[];
  artist: {
    id: string;
    username: string;
    full_name: string | null;
    /** Not loaded with the page: fetched on demand for people allowed to see it. */
    email?: string | null;
    avatar_url: string | null;
    bio: string | null;
    medium: string[] | null;
    career_stage: string | null;
    city: string | null;
    country: string | null;
    cv_url: string | null;
    exhibition_history: Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }> | null;
    received_grants: string[] | null;
    is_patronage_supported: boolean;
    year_of_birth: number | null;
    identity_tags: string[];
  } | null;
}

export interface OpportunityShape {
  id: string;
  title: string;
  type?: string;
  slug?: string | null;
  custom_fields: CustomField[];
  show_badges_in_submission: boolean;
  pipeline_config?: PipelineConfig | null;
  view_count?: number;
}
