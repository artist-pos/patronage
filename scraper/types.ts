export interface Source {
  name: string;
  url: string;
  country: string; // default country for opportunities from this source
  isRss?: boolean; // parse as RSS/Atom feed
  isListPage?: boolean; // page lists multiple opportunities — extract all
  needsBrowser?: boolean; // page requires JS execution (use Playwright)
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
}

export interface RssItem {
  title: string;
  content: string;
  link: string;
  pubDate: string;
}
