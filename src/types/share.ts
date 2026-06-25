export type ShareType = 'work' | 'update' | 'support' | 'profile' | 'blog' | 'opportunity'
export type ShareTemplate = 'dark' | 'light' | 'warm' | 'slate'
export type ShareFormat = 'story' | 'post'

export interface ShareImageOption {
  url: string;
  label: string;
}

/**
 * Opportunity-specific card data. Carried on SharePayload.opportunity when
 * type === 'opportunity'. The canvas selects one of three layout variants
 * (A pure-typographic / B image-accent / C light-with-commission) from this
 * data — see drawOpportunityCanvas.
 */
export interface OpportunityShareData {
  /** Listing organisation name, shown in uppercase under the title. */
  organisation: string;
  /** Outlined pill row — e.g. ["Open Call", "NZ", "Sculpture"]. */
  tags: string[];
  /** Whether to show a red "Free" entry-fee pill in the tag row. */
  isFree: boolean;
  /** Commission/funding label for data rows — e.g. "$25,000 – $50,000" or "$25k". Null if unknown. */
  commission: string | null;
  /**
   * Explicit dollar commission value used as the Variant C focal point and to
   * drive variant selection. Only set when a concrete funding amount exists
   * (not a vague range/text). Null otherwise.
   */
  commissionAmount: string | null;
  /** Formatted deadline — e.g. "30 June 2026". Null if rolling/none. */
  deadline: string | null;
  /** City/region/country line. Null if unknown. */
  location: string | null;
  /** Entry-fee label for the data grid — e.g. "Free" or "$25 NZD". Null if unknown. */
  entryFee: string | null;
  /** Determines the swipe hint: pipeline → "swipe to apply", external → "swipe to view". */
  routingType: 'pipeline' | 'external';
}

export type OpportunityVariant = 'A' | 'B' | 'C'
export type OpportunityTheme = 'light' | 'dark'

/** How the image is panned/zoomed within the Variant B frame. */
export interface OpportunityImageTransform {
  /** Zoom multiplier on top of the cover-fit base scale (1 = cover). */
  zoom: number
  /** Horizontal offset in destination (1080-wide) pixels. */
  ox: number
  /** Vertical offset in destination pixels. */
  oy: number
}

/** Render options the share sheet passes through for opportunity cards. */
export interface OpportunityRenderOptions {
  variant: OpportunityVariant
  theme: OpportunityTheme
  imageTransform: OpportunityImageTransform
}

export interface SharePayload {
  type: ShareType
  title: string
  sub: string
  price: string | null
  tag: string
  handle: string
  imageUrl: string | null
  shareUrl: string
  editionCount?: number | null
  imageOptions?: ShareImageOption[]
  /** Present only when type === 'opportunity'. */
  opportunity?: OpportunityShareData
}
