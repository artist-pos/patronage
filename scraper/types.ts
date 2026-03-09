export interface Source {
  name: string;
  url: string;
  country: string;          // default country for opportunities from this source
  disciplines?: string[];   // discipline hint — merged into every opp from this source
  is_recurring?: boolean;   // source emits recurring opportunities (e.g. monthly grants)
  recurrence_pattern?: string; // e.g. 'monthly', 'quarterly', 'annual'
  isRss?: boolean;          // parse as RSS/Atom feed
  isListPage?: boolean;     // page lists multiple opportunities — extract all
  needsBrowser?: boolean;   // page requires JS execution (use Playwright)
  followLinks?: boolean;    // follow individual opportunity links from the list page for full detail
  maxLinks?: number;        // cap on how many detail links to follow (default 20)
}

export interface ScrapedOpportunity {
  title: string;
  organiser: string;
  caption: string | null;
  type: string; // Grant | Residency | Commission | Open Call | Prize | Display
  country: string;
  opens_at: string | null; // YYYY-MM-DD — when applications open (null if already open or unknown)
  deadline: string | null; // YYYY-MM-DD
  url: string | null;
  funding_range: string | null;
  featured_image_url: string | null;
  disciplines: string[];   // discipline_enum values — extracted by AI or inherited from source
}

export interface RssItem {
  title: string;
  content: string;
  link: string;
  pubDate: string;
}
