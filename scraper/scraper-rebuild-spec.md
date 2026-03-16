# Patronage Scraper Rebuild — Claude Code Spec

## Context

Patronage (patronage.nz) is a cultural infrastructure platform for artists in New Zealand and Australia. It includes an opportunity listings feature powered by a web scraper that pulls grants, prizes, residencies, fellowships, and open calls from ~233 sources.

The scraper is currently broken. A full run across all 4 tiers produces ~2 new opportunities total. This spec covers a ground-up rebuild of the extraction and processing pipeline while keeping the existing infrastructure (GitHub Actions, Supabase, TypeScript/Node).

---

## Current Architecture

- **Language:** TypeScript, runs via `tsx run.ts`
- **Runtime:** GitHub Actions, Ubuntu, Node 20, Playwright for browser-rendered pages
- **Schedule:** Weekly on Wednesdays (cron), with `SCRAPER_TIER` env var splitting sources into 4 parallel matrix jobs
- **Database:** Supabase (PostgreSQL), upserted via `supabase-js`
- **AI extraction:** Claude API (Haiku) via Anthropic SDK — already wired up with `ANTHROPIC_API_KEY` secret
- **Source config:** Single `sources/index.ts` file exporting a `Source[]` array

### Current Flow

```
Source list → fetch HTML (axios or Playwright) → optionally follow links → send full HTML to Claude Haiku for extraction → upsert to Supabase
```

### Current Source Config Shape

```typescript
interface Source {
  name: string;
  url: string;
  country: string; // "NZ" | "AUS" | "Global" | "UK"
  isListPage?: boolean;
  isRss?: boolean;
  followLinks?: boolean;
  maxLinks?: number;
  needsBrowser?: boolean;
  disciplines?: string[];
  is_recurring?: boolean;
  recurrence_pattern?: string;
}
```

---

## Diagnosed Problems

### 1. Catastrophic Rate Limiting (PRIMARY ISSUE)

The scraper blows through the 50,000 input tokens/minute Haiku rate limit almost immediately. When `followLinks` is enabled, a single source can trigger 15-25 Claude API calls in rapid succession. Once rate-limited, every subsequent extraction fails with 429 errors for the rest of the run. This cascades across the entire tier.

**Evidence:** The logs show hundreds of 429 errors. Tier 1 alone has 40+ rate limit failures. The errors continue printing even after the scraper has moved on to new sources, suggesting fire-and-forget async calls that aren't properly awaited or cancelled.

### 2. Broken Link Following

The `followLinks` logic extracts all `<a>` tags from a page and follows them indiscriminately. It's scraping:
- Navigation links (`/about`, `/contact`, `/accessibility`)
- Footer links (`/privacy`, `/copyright`, `/sitemap`)
- Completely unrelated pages (`create.nsw.gov.au/driving-boating-and-transport`, `create.nsw.gov.au/emergency`)
- Spam/hijacked domains (`qwc.com.au/packaging/pallet-wrap-stretch-film`, `qwc.com.au/packaging/knives-blades` — this is clearly a hijacked domain, not Queensland Writers Centre)
- Individual artist profile pages (`gasworks.org.uk/studio-artists/shadi-al-atallah/`)
- Cloudflare email protection pages (`/cdn-cgi/l/email-protection`)

This wastes the majority of API calls on irrelevant pages.

### 3. Dead Sources (~50% of the list)

Roughly half the 233 sources return errors:
- `getaddrinfo ENOTFOUND` — domain doesn't exist anymore
- `404` — page moved or removed
- `403` — site blocks the scraper
- SSL/certificate errors
- Timeouts

Many of these were likely AI-generated URLs that were never verified. Examples of dead sources: Pub Charity NZ, Toi Māori Aotearoa, Nelson Marlborough Trust, Burnie Print Prize, Stanthorpe Art Prize, and dozens more.

### 4. No HTML Trimming

Full page HTML (nav, footer, scripts, ads, tracking pixels, cookie banners) is sent to the Claude API. This:
- Burns tokens unnecessarily (a typical page might be 80% boilerplate)
- Contributes to rate limiting by inflating input token counts
- Confuses extraction by including irrelevant content

### 5. Poor Relevance Filtering

The scraper has no mechanism to assess whether an opportunity is actually relevant to NZ/AUS artists. International opportunities with geographic restrictions (e.g. "US citizens only") get scraped and inserted, requiring manual cleanup.

### 6. Low-Quality Source Selection

The source list was AI-generated and includes many low-yield sources. Individual gallery websites and prize pages that update once a year are scraped weekly. Meanwhile, high-quality aggregators that curate opportunities are underrepresented.

**User-identified missing aggregators:**
- applyforart.com
- artinfoland.com/opportunities
- artdeadline.com

---

## Rebuild Requirements

### Phase 1: Source List Triage

**Goal:** Go from 233 broken sources to a clean, verified list.

1. **Health check script** — Write a standalone script (`scripts/health-check.ts`) that:
   - Tests every URL in the source list (HEAD request, then GET if HEAD fails)
   - Records: HTTP status, response time, whether it redirects, final URL
   - Outputs a report of dead/broken/redirected sources
   - Can be run independently: `npm run health-check`

2. **Remove dead sources** — Delete any source that consistently fails (DNS errors, 404s, 403s with no workaround)

3. **Add high-quality aggregators** — Research and add these (verify URLs first):
   - applyforart.com
   - artinfoland.com/opportunities  
   - artdeadline.com
   - Any other major arts opportunity aggregators for NZ/AUS/Global

4. **Tier restructuring** — Re-tier sources by actual yield:
   - Tier 1: High-yield aggregators that list many opportunities per page (weekly)
   - Tier 2: Government/funded body sources with regular updates (weekly)
   - Tier 3: Individual prizes/residencies that update seasonally (fortnightly or monthly)
   - Tier 4: Low-frequency sources (monthly)

### Phase 2: Link Following Fix

**Goal:** Only follow links that are actual opportunity detail pages.

Replace the current "follow all links" approach with smart link filtering:

1. **URL pattern matching** — Before following a link, check it against:
   - **Blocklist patterns:** `/about`, `/contact`, `/privacy`, `/accessibility`, `/sitemap`, `/login`, `/register`, `/cdn-cgi/`, `/feed/`, `/tag/`, `/category/`, `/author/`, `/cart`, `/search`, navigation anchors (`#`), mailto:, tel:, social media domains, file downloads (.pdf, .doc, .zip unless it's clearly a listing page)
   - **Same-domain only:** Don't follow links to external domains (unless the source is an aggregator that links to external opportunity pages — handle this as a config flag)
   - **Allowlist patterns:** URLs containing keywords like `/opportunity`, `/grant`, `/funding`, `/prize`, `/residency`, `/fellowship`, `/open-call`, `/apply`, `/submission`

2. **Configurable per source** — Some sources have predictable URL structures. Allow source config to specify:
   ```typescript
   linkPattern?: string | RegExp; // Only follow links matching this pattern
   ```

3. **Limit followed links** — Default `maxLinks` to 10 (currently 20), and respect it strictly.

### Phase 3: HTML Trimming

**Goal:** Reduce token usage by 70-80% by sending only relevant content to Claude.

Before sending page content to the Claude API:

1. **Strip boilerplate:**
   - Remove `<nav>`, `<footer>`, `<header>`, `<aside>` elements
   - Remove `<script>`, `<style>`, `<noscript>`, `<iframe>` elements
   - Remove elements with common boilerplate classes/IDs: `cookie`, `banner`, `sidebar`, `nav`, `menu`, `footer`, `header`, `social`, `share`, `comment`, `ad`, `advertisement`, `popup`, `modal`
   - Remove hidden elements (`display: none`, `aria-hidden="true"`)

2. **Extract main content:**
   - Prefer content within `<main>`, `<article>`, `[role="main"]`, `.content`, `.post-content`, `.entry-content`
   - If none found, fall back to `<body>` with boilerplate stripped

3. **Convert to clean text:**
   - Convert remaining HTML to clean markdown or plain text (preserve headings, lists, links, basic structure)
   - Truncate to a reasonable max (e.g. 8,000 tokens / ~30,000 chars) — most opportunity pages are well under this

4. **Implement as a utility function:**
   ```typescript
   function trimHtml(rawHtml: string): string
   ```

### Phase 4: Rate Limit Handling

**Goal:** Never hit 429 errors. Stay comfortably under the 50,000 input tokens/minute limit.

1. **Token-aware queuing:**
   - Estimate input tokens before each API call (rough: chars / 4)
   - Track tokens used in a sliding 60-second window
   - If the next call would exceed ~40,000 tokens in the window, wait until the window clears
   - This is more important than simple time-based delays

2. **Exponential backoff on 429:**
   - If a 429 is received despite the queue, wait and retry with exponential backoff (1s, 2s, 4s, 8s, max 3 retries)
   - Log the backoff for debugging

3. **Per-source timeout increase:**
   - Current `SOURCE_TIMEOUT_MS` is 30s, which is too short for sources with many links + rate limiting delays
   - Increase to 120s, or make it dynamic based on the number of links to follow

4. **Rate limit between sources:**
   - Keep the existing 2s `RATE_LIMIT_MS` between sources
   - Add a 1s delay between followed links within a source (currently exists but gets swamped by concurrent async work from previous sources — ensure clean sequential processing)

### Phase 5: Improved Extraction Prompt

**Goal:** Get clean, structured, relevant data from Claude in one pass.

Replace the current extraction prompt with one that:

1. **Returns structured JSON** with this schema:
   ```typescript
   interface ExtractedOpportunity {
     title: string;
     organisation: string;
     url: string;
     description: string; // 2-3 sentence summary
     deadline: string | null; // ISO date, or "rolling", or "ongoing", or null
     type: "grant" | "prize" | "residency" | "fellowship" | "open_call" | "commission" | "exhibition" | "workshop" | "other";
     disciplines: string[]; // from controlled vocabulary
     eligibility: {
       open_to_nz: boolean | null; // null = unclear
       open_to_aus: boolean | null;
       open_internationally: boolean | null;
       restrictions: string | null; // e.g. "US citizens only", "emerging artists under 35"
     };
     funding_amount: string | null; // e.g. "$5,000", "$10,000-$20,000", "fully funded"
     location: string | null; // where the opportunity takes place
     featured_image_url: string | null;
     confidence: number; // 0-1, how confident the extraction is
     is_opportunity: boolean; // false if the page is not actually an opportunity listing
   }
   ```

2. **Filters non-opportunities:** If the page is an about page, news article, general info page, or doesn't contain a specific opportunity, return `is_opportunity: false`. This prevents inserting junk.

3. **Assesses eligibility:** Explicitly evaluates whether the opportunity is open to NZ and/or AUS based artists. If eligibility says "US citizens only" or "UK residents", mark accordingly.

4. **Uses a controlled discipline vocabulary:**
   ```
   visual_art, painting, sculpture, photography, printmaking, drawing,
   ceramics, textile, digital_art, new_media, installation, performance,
   film, animation, music, sound_art, writing, poetry, dance, theatre,
   craft, design, architecture, curation, multidisciplinary, other
   ```

5. **Handles list pages:** When a page contains multiple opportunities (common for aggregator list pages), extract all of them as an array. When a page is a single opportunity detail page, return an array of one.

### Phase 6: Validation & Deduplication

**Goal:** Catch bad data before it hits Supabase.

1. **Pre-insert validation:**
   - `title` is required and non-empty
   - `url` is a valid URL
   - `is_opportunity` must be true
   - `confidence` must be above 0.5 (below = queue for manual review instead of auto-inserting)
   - `deadline` if present must be a valid date or known keyword ("rolling", "ongoing")
   - `disciplines` must not be empty (use source-level default if extraction returns empty)
   - `eligibility.open_to_nz` or `eligibility.open_to_aus` or `eligibility.open_internationally` must be true (if all are false, skip — it's not relevant to the platform's audience)

2. **Deduplication:**
   - Before upserting, check if an opportunity with the same URL already exists
   - Also check title similarity (fuzzy match) within the same organisation to catch re-listings with slightly different URLs
   - Update existing records if deadline or details have changed

3. **Null constraint handling:**
   - The current code has a bug where `disciplines` can be null, violating a NOT NULL constraint in Supabase. Ensure disciplines always defaults to an array (at minimum `["other"]`)

### Phase 7: Monitoring & Reporting

**Goal:** Know when things break without manually checking logs.

1. **Per-source stats tracking:**
   - Record: source name, status (success/error/timeout/rate_limited), opportunities found, opportunities inserted, response time, tokens used
   - Write to a JSON stats file (already partially implemented via `SCRAPER_STATS_PATH`)

2. **Health dashboard data:**
   - After each run, write a summary to Supabase (a `scraper_runs` table) with:
     - Run timestamp, tier, total sources, successes, failures, timeouts, rate_limit_hits, opportunities_inserted, opportunities_updated, duration_seconds
   - This lets you build a dashboard later

3. **Source health tracking:**
   - Track consecutive failures per source
   - After 3 consecutive failures, flag the source as potentially dead (don't remove automatically, but log a warning)

---

## Technical Constraints

- **No network access from this environment** — all code must be written without testing against live URLs
- **GitHub Actions runner** — Ubuntu latest, 55 minute timeout per tier job
- **Anthropic API** — Haiku model, 50,000 input tokens/minute rate limit. The `ANTHROPIC_API_KEY` is already in GitHub secrets
- **Supabase** — existing `opportunities` table with NOT NULL constraint on `disciplines`
- **Playwright** — already installed in the workflow for `needsBrowser` sources
- **NZ spelling conventions** — use "organisation" not "organization" in user-facing text

## File Structure (Expected)

```
scraper/
├── run.ts                    # Main entry point (rebuild)
├── package.json
├── tsconfig.json
├── types.ts                  # Shared types
├── sources/
│   └── index.ts              # Cleaned source list
├── lib/
│   ├── fetch.ts              # HTTP fetching, browser fetching, RSS parsing
│   ├── extract.ts            # Claude API extraction (REBUILD)
│   ├── trim.ts               # HTML trimming (NEW)
│   ├── filter-links.ts       # Smart link filtering (NEW)
│   ├── rate-limiter.ts       # Token-aware rate limiting (NEW)
│   ├── validate.ts           # Pre-insert validation (NEW)
│   └── upsert.ts             # Supabase upsert
├── scripts/
│   └── health-check.ts       # Standalone source health checker (NEW)
└── prompts/
    └── extract.ts             # Extraction prompt template (NEW)
```

## Priority Order

If you need to break this into stages, prioritise:

1. **HTML trimming** (`lib/trim.ts`) — biggest bang for buck, reduces token usage immediately
2. **Rate limiter** (`lib/rate-limiter.ts`) — prevents the cascade failure that kills every run  
3. **Link filtering** (`lib/filter-links.ts`) — stops wasting API calls on junk pages
4. **Extraction prompt** (`prompts/extract.ts`) — gets cleaner data with eligibility filtering
5. **Validation** (`lib/validate.ts`) — catches bad data before Supabase
6. **Source list cleanup** — remove dead sources, add better ones
7. **Health check script** — ongoing maintenance tool
8. **Monitoring** — nice to have, not critical for first working version

## Notes

- The existing `fetch.ts` and `upsert.ts` modules can likely be kept mostly as-is. The main rebuild targets are extraction, link following, and rate limiting.
- The GitHub Actions workflow YAML doesn't need changes — it already passes the right env vars and installs Playwright.
- Test the rebuild against a small subset of sources first (e.g. 5-10 known-good sources) before running the full list.
- The `country` field on sources should influence extraction — if a source is tagged `"NZ"`, opportunities from it are assumed to be NZ-relevant without needing the LLM to assess eligibility.
