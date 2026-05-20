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
  maxLinks?: number;        // cap on how many detail links to follow (default 10)
  linkPattern?: string | RegExp; // only follow links whose path/URL matches this pattern
  pages?: number;           // number of paginated list pages to scrape (default 1)
  paginationUrl?: string;   // URL template for pages 2+, with {page} placeholder e.g. "https://example.com/page/{page}/"
  isAggregator?: boolean;   // detail pages link out to the real provider — store outbound URL instead of aggregator URL
  sitemapUrl?: string;      // sitemap.xml URL (absolute or path) — overrides list-page discovery
  sitemapLastmodOnly?: boolean; // skip URLs whose <lastmod> is not newer than last_seen_at
  detailBudget?: number;    // per-source cap on detail pages (overrides SOURCE_DETAIL_BUDGET env var)
  feedUrl?: string;         // WordPress REST endpoint path e.g. "/wp-json/wp/v2/posts"
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
  full_description: string | null; // structured description with "Heading:" section lines
  featured_image_url: string | null;
  disciplines: string[];   // discipline_enum values — extracted by AI or inherited from source
}

export interface RssItem {
  title: string;
  content: string;
  link: string;
  pubDate: string;
}
