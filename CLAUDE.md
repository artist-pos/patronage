# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Patronage** is a full-featured web platform connecting NZ and Australian artists with grants, residencies, commissions, and other arts funding opportunities. Key features:

- **Opportunity aggregator** — scrapes 50+ sources weekly; surfaces NZ/AUS-eligible grants, residencies, open calls
- **Artist profiles** — portfolio, exhibitions, press, CV, studio feed, available works
- **Studio Feed** — masonry feed of live project updates (image, audio, video, text, embed)
- **Messaging** — DMs, artwork provenance transfers, enquiries
- **Application pipeline** — artists apply directly to pipeline opportunities; partners review submissions
- **Role-based dashboards** — artists, patrons, partners, admins

**Language**: Always use NZ/British spelling in all user-facing text: organise, colour, honour, behaviour, centre, travelling, cancelled, analyse, favour, programme (arts context). Never US spellings.

---

## Commands

```bash
# App
npm run dev          # Next.js dev server
npm run build        # Production build (also type-checks)
npm run lint         # ESLint
npx tsc --noEmit     # Type-check without building

# Scraper (run from scraper/ directory)
cd scraper
SCRAPER_TIER=1 npm run scrape   # Run one tier (1–4); omit SCRAPER_TIER to run all
npm run diagnose                # Discovery-level dry run per source (no Claude, no DB writes)
npm run guard                   # Zero-yield regression guard vs tools/yield-baseline.json
npm run dedupe -- --dry-run     # Cross-source duplicate collapse (drop --dry-run to apply)
npm test                        # Scraper unit tests (sitemap parser, dedupe, yield guard)
```

The app itself has no automated tests — type-checking (`npx tsc --noEmit`) is the primary correctness signal. The scraper has unit tests in `scraper/tests/`.

---

## Environment Variables

Copy `.env.local.example` → `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key — bypasses RLS; server only |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (no trailing slash) |
| `RESEND_API_KEY` | Email sending |
| `CRON_SECRET` | Guards `/api/cron/*` routes |
| `ANTHROPIC_API_KEY` | Used by `/api/parse-opportunity` |
| `STRIPE_SECRET_KEY` | Commerce |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |

Scraper uses a separate `scraper/.env` with `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | Supabase (Postgres + RLS + Realtime + Auth) |
| Email | Resend |
| Hosting | Vercel |
| Scraper | Node.js + Playwright + Cheerio + Claude API (Haiku) |
| Image transforms | Supabase Storage render endpoint |
| DnD | @dnd-kit |
| Icons | Lucide React |

---

## Folder Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── [username]/             # Public artist profile page
│   ├── admin/                  # Admin dashboard
│   ├── api/                    # API routes (opportunities, feed, analytics, search, stripe webhook)
│   ├── auth/                   # Signup, login, onboarding
│   ├── dashboard/              # Patron dashboard + collection
│   ├── feed/                   # Studio feed masonry page
│   ├── messages/               # DM conversations
│   ├── opportunities/          # Opportunity browser + detail pages
│   ├── partner/                # Partner dashboard (submission review)
│   ├── studio/                 # Artist studio (works, earnings, connect, campaigns, provenance)
│   ├── globals.css             # Tailwind + CSS custom properties
│   └── layout.tsx              # Root layout with Header/Footer
│
├── components/
│   ├── artists/                # ArtistCard, artist directory
│   ├── feed/                   # CreateUpdateModal
│   ├── layout/                 # Header, NavBar, Footer
│   ├── messages/               # ChatWindow, TransferWorkButton
│   ├── opportunities/          # OpportunityCard, MasonryGrid, SaveButton, ApplyButton
│   ├── profile/                # PortfolioGrid, PortfolioUploader, ProfileTabs,
│   │                           #   tabs/ (OverviewTab, WorkTab, StudioTab, etc.)
│   │                           #   StudioCarousel, CollectionSection, SoldWorksSection
│   └── ui/                     # shadcn/ui primitives (Button, Input, Badge, etc.)
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts           # SSR Supabase client (cookie-based auth)
│   │   ├── client.ts           # Browser Supabase client
│   │   └── admin.ts            # Admin client — bypasses RLS (service role key)
│   ├── commerce/               # One handler file per commerce surface (see Commerce below)
│   ├── profiles.ts             # getProfileById, getProfiles, getPortfolioImages
│   ├── opportunities.ts        # getOpportunities, getClosingSoonOpportunities
│   ├── feed.ts                 # getLatestUpdates, getArtistUpdates
│   ├── projects.ts             # getThread, getArtistProjects
│   ├── messages.ts             # getMessages, getUnreadCount
│   ├── email.ts                # Resend templates + send functions (uses admin client)
│   ├── stripe.ts               # Stripe client + CheckoutPurpose type + checkout helpers
│   ├── commerce-fee.ts         # CommerceSurface type + fee calculation
│   ├── image.ts                # gridImageSrc(), detectOrientation(), orientationClass()
│   ├── badges.ts               # computeBadges()
│   └── saved-opportunities.ts  # getSavedOpportunities, categorizeSaved
│
├── actions/                    # Shared server actions ("use server")
│   ├── updates.ts              # createUpdate, deleteUpdate
│   └── projects.ts             # createProject
│
└── types/
    └── database.ts             # All TypeScript interfaces for DB records

scraper/
├── run.ts                      # Main orchestrator; reads SCRAPER_TIER
├── sources/index.ts            # 50+ source definitions
├── lib/
│   ├── fetch.ts                # Axios + Cheerio + Playwright
│   ├── extract.ts              # Claude API extraction
│   └── upsert.ts               # Dedup + insert/update
└── types.ts                    # Source, ScrapedOpportunity interfaces

supabase/migrations/            # 156+ SQL migrations (run manually in Supabase SQL Editor)
```

---

## Component Conventions

- **Server components** (default): async functions in `src/app/` that fetch data directly
- **Auth in RSCs**: never call `supabase.auth.getUser()` directly — use `getServerUser()` (`src/lib/supabase/get-server-user.ts`). It's React.cache'd, so Header, MobileTabBarServer, and the page share ONE auth round-trip per request. Middleware (`src/proxy.ts`) still calls getUser itself (required for token refresh) — leave it.
- **Shared public reads** (same data for every visitor — browse lists, stats, directory aggregates): wrap in `unstable_cache` with a 5-min revalidate + tag, using `createPublicClient()` (cookie-free — `cookies()` inside `unstable_cache` throws). Pattern: `getCachedHomeData` in `src/app/page.tsx`.
- **Vercel region**: `vercel.json` pins `"regions": ["syd1"]` to co-locate functions with Supabase (Sydney) and ANZ users. Do not remove — the default (iad1, US East) adds ~200ms per query round-trip.
- **Client components**: `"use client"` at top; live in `src/components/`
- **Server actions**: `"use server"` in `src/app/*/actions.ts` or `src/actions/`; return `{ error?: string }` objects
- **Props**: Typed with inline `interface Props {}` in the same file
- **Optimistic UI**: `useState` immediately, reconcile on server response
- **Toast**: Inline state + `setTimeout(3000)` pattern
- **Email**: Fire-and-forget `.catch(console.error)` — never awaited in user-facing code
- **Admin client** (bypasses RLS): Only used in `src/lib/email.ts`, `src/lib/commerce/`, and transfer actions — never in client components
- **Page width**: Outer container of any new page is `max-w-[1600px]`

---

## Commerce Architecture

All Stripe payments flow through a single webhook at `src/app/api/stripe/webhook/route.ts`. It dispatches on `session.metadata.purpose` (typed as `CheckoutPurpose` / `CommerceSurface`) to a handler in `src/lib/commerce/`:

| Purpose | Handler | Surface |
|---|---|---|
| `primary_sale` | `primary-sale-handler.ts` | Buy work directly from artist profile |
| `resale` | `resale-handler.ts` | Patron re-selling a work |
| `negotiated_sale` | `negotiated-sale-handler.ts` | Offer → accept flow via messages |
| `campaign_sale` | `campaign-sale-handler.ts` | Campaign storefront purchase |
| `pipeline_entry_fee` | `pipeline-handler.ts` | Application entry fee |
| `featured_listing` | `featured-handler.ts` | Artist pays to feature a listing |
| `support_one_off` / `support_recurring` | `support-handler.ts` | Patron support tiers |
| `partner_submission` | `partner-submission-handler.ts` | Partner pays to submit |

**Adding a new commerce surface**: create `src/lib/commerce/<surface>-handler.ts`, register it in `COMPLETED_HANDLERS` in the webhook route, add the purpose to `CommerceSurface` in `src/lib/commerce-fee.ts`.

**Stripe Connect**: Artists connect their bank via Stripe Express (`src/app/studio/connect/`). `profiles.stripe_account_id` + `profiles.stripe_connect_status` (`pending|enabled|restricted|null`) track state.

---

## Migrations

Migrations are plain SQL files in `supabase/migrations/`. There is no CLI migration runner — **run them manually in the Supabase SQL Editor**. Name new files sequentially: `157_description.sql`. The special file `RUN_THIS_IN_SUPABASE.sql` contains aggregate fixes run ad-hoc.

---

## Image Handling

### Rule: Do NOT use Next.js `<Image>` in masonry grids or justified grids

The Next.js `<Image>` component requires known `width` and `height` props. In masonry/flex-wrap grids where dimensions vary, it fights with inline styles and produces incorrect sizing. Use plain `<img>` tags instead.

### Image sizing: our own compressor is the single source of truth

Do **NOT** use Supabase's render/image transform endpoint (`/storage/v1/render/image/...` or `?width=&quality=&resize=` on storage URLs). Every image is already resized + re-encoded to WebP on upload by our own compressor (`src/lib/image-processing.ts` → `/api/upload/image`), which also generates a thumbnail. Running Supabase's transform on top of that is redundant and was removed.

Serve the **stored object URL directly**. For grid/feed tiles use `gridImageSrc(fullUrl, thumbUrl)` (`src/lib/image.ts`) — it prefers the pre-generated thumbnail, else the compressed original. `detectOrientation()` / `orientationClass()` also live in `image.ts`.

### Zoomable artwork viewer — `src/components/ui/ZoomableImage.tsx`

Artwork lightboxes use `<ZoomableImage>` for pinch / double-tap / wheel zoom. It sets `touch-action: none` (`.zoom-surface`) so the page-level pinch-zoom lock in `globals.css` (`body { touch-action: pan-x pan-y }`) doesn't swallow the gesture. The viewport meta stays zoom-permissive — never add `user-scalable=no` / `maximum-scale=1`.

### Portfolio Grid — `src/components/profile/PortfolioGrid.tsx`

- Plain `<img>` tags
- Mobile: 2-column CSS grid (`grid grid-cols-2`)
- Desktop: flex-wrap (`md:flex md:flex-wrap`), each image `md:w-fit`
- Landscape images (`naturalWidth / naturalHeight > 1.2`) → `col-span-2` on mobile
- Aspect ratio detected via `onLoad` handler reading `naturalWidth/naturalHeight`
- Click → opens `PortfolioDetailModal`
- **Do not** add `max-height`, `object-fit`, or fixed container heights — these break the natural flow

### Studio Feed — `src/app/feed/page.tsx`

- Content-type aware: image / audio / video / embed / text
- Images: Next.js `<Image>` with `unoptimized width={600} height={600}` and `style={{ width:"100%", height:"auto" }}` — renders at natural aspect ratio
- Mobile layout: manual 2-column flex split (NOT CSS columns — iOS Safari bug with `break-inside-avoid`)
- Desktop: CSS `columns-3 lg:columns-4 xl:columns-5 gap-2`

### Opportunity Cards — `src/components/opportunities/OpportunityCard.tsx`

- Gallery mode: `<img>` with `height: 200px`, `objectFit: "contain"`, `backgroundColor: "#f5f5f5"` — logos must not be cropped
- List mode: Next.js `<Image>` 56×56 thumbnail with `object-contain`
- `priority={true}` for first 3 cards (LCP optimisation)

### Profile Banners — `src/app/[username]/page.tsx`

- Featured banner: plain `<img>` served from the stored (already-compressed) URL — no transform
- Avatar: Next.js `<Image>` with `fill` + `object-cover`

---

## Supabase Patterns

```typescript
// Server client (SSR, cookie auth)
const supabase = await createClient();

// Admin client (bypasses RLS — server only)
const admin = createAdminClient();

// Fetch with join
const { data } = await supabase
  .from("project_updates")
  .select(`
    id, content_type, image_url, caption,
    profiles!project_updates_artist_id_fkey (username, full_name, avatar_url)
  `)
  .eq("artist_id", id)
  .order("created_at", { ascending: false });

// Array contains filter
.contains("sub_categories", ["Photography"])

// OR filter
.or(`deadline.gte.${today},deadline.is.null`)

// Upsert with conflict resolution
.upsert({ ...data }, { onConflict: "url" })

// Get auth user email (admin only — not in profiles table)
const { data: { user } } = await admin.auth.admin.getUserById(userId);
```

**RLS summary**:
- Public: opportunities (published), profiles (public fields), feed updates
- Authenticated: own profile edits, own messages, own portfolio
- Admin client only: email lookups in `auth.users`, provenance transfers, commerce handlers

---

## Tailwind Conventions

```css
/* globals.css — key custom properties */
--background: #FAFAF9;         /* Warm off-white — NOT pure white */
--foreground: oklch(0 0 0);    /* Black */
--primary: oklch(0 0 0);       /* Black */
--muted-foreground: oklch(0.533 0 0); /* ~#888 */
--border: oklch(0.922 0 0);    /* Light grey */
--radius-xl: 0.75rem;          /* Rounding is allowed — globals no longer force 0 */
```

**Design system**:
- Warm off-white background (`#FAFAF9`), black foreground — minimal colour
- No dark mode
- Border radius is now allowed (`rounded-xl`, `rounded-full` work)
- Box shadows are now allowed (`shadow-sm`, `shadow-md` work)
- Section headings: `text-xs font-medium uppercase tracking-widest text-stone-400`
- Card tags / pills: `bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs`
- Primary button: black bg, white text, `rounded-lg`

---

## Database Schema

Full schema: `src/types/database.ts`. Key facts:
- `artworks` — marketplace (available + sold); `portfolio_images` — archival only (`is_available=false`)
- `artworks.creator_id` immutable; `artworks.current_owner_id` changes on transfer
- `opportunities.routing_type` — `external` | `pipeline`; pipeline opps use `opportunity_applications`
- `opportunity_applications.status` — `pending|shortlisted|selected|approved_pending_assets|production_ready|rejected`
- `messages.message_type` — `text|transfer_request|transfer_accepted|work_offer`
- `profiles.role` — `artist|owner|patron|partner|admin` (no "collector" role)
- `profiles.stripe_account_id` + `profiles.stripe_connect_status` — Stripe Express connect state

---

## Scraper Architecture

```
SCRAPER_TIER=1 (or 2,3,4) → run.ts selects quarter of sources array
                           → unset = run all sources

Source URL
  → fetchPageContent() [axios+cheerio] or fetchWithBrowser() [Playwright]
  → extractFromPage() [Claude Haiku API → JSON array of opportunities]
  → applySourceMeta() [merge disciplines from source definition]
  → resolveOrgImage() [extract org logo from page if no featured_image_url]
  → upsertOpportunity() [dedup by URL or title+organiser; insert/update/skip]
```

**CI**: GitHub Actions matrix runs 4 parallel jobs (`tier: [1,2,3,4]`), each with 80-minute timeout, followed by a `dedupe` job (collapses cross-posted duplicates) and a `yield-guard` job (fails the workflow when a source that historically yielded >5 discovers 0 — the silent-selector-break signal). Do NOT run all sources in a single job — it will time out.

**Source definition**: `scraper/sources/index.ts` — each source has `name, url, country, disciplines[], needsBrowser, isRss, followLinks, maxLinks`, plus optional `sitemapUrl/sitemapLastmodOnly/sitemapMaxAgeDays` (sitemap-first discovery — preferred where a usable sitemap exists; run.ts falls back to list-page discovery when a sitemap is blocked or empty), `allowExternalDomains` (multi-tenant hosts like *.artcall.org), and `authority` (dedupe canonical rank: 1 org page, 2 primary aggregator, 3 secondary aggregator).

**Dedupe**: insert-time fuzzy check in `lib/upsert.ts` + retro pass `tools/dedupe-pass.ts` (both use `lib/dedupe.ts` — token_sort_ratio ≥90 within a ±3-day deadline window). Canonical record keeps other sources' URLs in `opportunities.alternate_source_urls` (migration 172). `needsBrowser: true` is also the standard fix for WAF 403s (TLS-fingerprint blocks).

---

## Known Fragile Areas — Do Not Break

### 1. Feed masonry layout (mobile)
CSS `columns` breaks on iOS Safari inside flex containers. Mobile uses a manual 2-column split:
```tsx
{[0, 1].map(col => (
  <div className="flex flex-col gap-2 flex-1">
    {updates.filter((_, i) => i % 2 === col).map(u => <FeedCard u={u} />)}
  </div>
))}
```
Do not replace this with CSS columns on mobile.

### 2. Portfolio grid image dimensions
The portfolio grid detects landscape/portrait from `naturalWidth/naturalHeight` on load. Do not:
- Add `aspect-ratio` CSS to portfolio image containers
- Add `max-height` constraints that crop images
- Replace the `<img>` onLoad handler with server-side orientation detection (it won't SSR correctly for width-auto layouts)

### 3. Opportunity card images
Always use `object-fit: contain` for opportunity/partner logo images. Using `cover` will crop logos and look broken. The 200px fixed height with `contain` is intentional.

### 4. Next.js `<Image>` in grids
Never use `<Image>` from `next/image` in masonry or flex-wrap grids where image dimensions are variable. It overrides inline styles and produces incorrect tile sizes. Use plain `<img>` tags.

### 5. Supabase admin client exposure
`createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY`. Never import or use it in client components (`"use client"`). Only use in server actions and `src/lib/email.ts`.

### 6. StudioCarousel tile widths
The artist profile StudioCarousel uses `CAROUSEL_H` fixed height with `width: auto` and `shrink-0` on each tile. Do not add `flex: 1`, `w-full`, or `min-width` to carousel items — they will expand incorrectly.

---

## What NOT To Do

- ❌ Use `<Image>` from `next/image` in masonry or justified-layout grids
- ❌ Add `aspect-ratio` constraints to portfolio image containers
- ❌ Add `object-fit: cover` to opportunity/partner logo images
- ❌ Run all scraper sources in a single CI job — parallelise with `SCRAPER_TIER`
- ❌ Use the Supabase admin client in any client component
- ❌ Use US spellings in user-facing text
- ❌ Add `border-radius: 0 !important` or `box-shadow: none !important` back to globals — these were intentionally removed
- ❌ Revalidate paths on every keystroke — only revalidate after confirmed mutations
- ❌ Add dark mode variants — this is a light-only design
