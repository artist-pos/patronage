# Patronage — Claude Code Guide

Read this file before making any changes to the codebase.

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
│   ├── api/                    # API routes (opportunities, feed, analytics, search)
│   ├── auth/                   # Signup, login, onboarding
│   ├── dashboard/              # Artist + patron dashboards
│   ├── feed/                   # Studio feed masonry page
│   ├── messages/               # DM conversations
│   ├── onboarding/             # Role selection + profile setup
│   ├── opportunities/          # Opportunity browser + detail pages
│   ├── partner/                # Partner dashboard (submission review)
│   ├── profile/                # Profile editing
│   ├── projects/               # Project threads
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
│   ├── profiles.ts             # getProfileById, getProfiles, getPortfolioImages
│   ├── opportunities.ts        # getOpportunities, getClosingSoonOpportunities
│   ├── feed.ts                 # getLatestUpdates, getArtistUpdates
│   ├── projects.ts             # getThread, getArtistProjects
│   ├── messages.ts             # getMessages, getUnreadCount
│   ├── email.ts                # Resend templates + send functions (uses admin client)
│   ├── image.ts                # supabaseTransform(), detectOrientation(), orientationClass()
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

supabase/migrations/            # 051 migrations (numbered 001–051)
```

---

## Component Conventions

- **Server components** (default): async functions in `src/app/` that fetch data directly
- **Client components**: `"use client"` at top; live in `src/components/`
- **Server actions**: `"use server"` in `src/app/*/actions.ts` or `src/actions/`; return `{ error?: string }` objects
- **Props**: Typed with inline `interface Props {}` in the same file
- **Optimistic UI**: `useState` immediately, reconcile on server response
- **Toast**: Inline state + `setTimeout(3000)` pattern
- **Email**: Fire-and-forget `.catch(console.error)` — never awaited in user-facing code
- **Admin client** (bypasses RLS): Only used in `src/lib/email.ts` and transfer actions — never in client components

---

## Image Handling

### Rule: Do NOT use Next.js `<Image>` in masonry grids or justified grids

The Next.js `<Image>` component requires known `width` and `height` props. In masonry/flex-wrap grids where dimensions vary, it fights with inline styles and produces incorrect sizing. Use plain `<img>` tags instead.

### `supabaseTransform(url, { width, quality })` — `src/lib/image.ts`

Converts Supabase Storage URLs from `/storage/v1/object/public/` to `/storage/v1/render/image/public/` with `?width=&quality=` params. Use this for images where you want server-side resizing (profile banners, thumbnails). Returns `null` if the URL is not a Supabase storage URL.

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

- `supabaseTransform(url, { width: 1600, quality: 85 })` for the featured banner
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
```

**RLS summary**:
- Public: opportunities (published), profiles (public fields), feed updates
- Authenticated: own profile edits, own messages, own portfolio
- Admin client only: email lookups in `auth.users`, provenance transfers

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

## Database Schema — Key Tables

### `profiles`
`id, username, full_name, bio, country, role (artist|patron|partner|owner|admin)`
`avatar_url, featured_image_url, cv_url, professional_cv_url`
`medium[], disciplines[], career_stage`
`exhibition_history[], press_bibliography[], received_grants[]`
`hide_sold_section, collection_public, support_enabled`

### `portfolio_images` (archival — always `is_available=false`)
`id, profile_id, url, caption, description, position`
`creator_id, current_owner_id` (immutable — stays with creator)
`hide_from_archive, orientation, natural_width, natural_height`
`content_type (image|audio|video|text|document|embed)`
`audio_url, video_url, text_content`

### `artworks` (marketplace — available + sold)
`id, profile_id, creator_id, current_owner_id`
`content_type, discipline, title, caption`
`image_url, audio_url, video_url, text_content, embed_url`
`price, is_available, hide_available, collection_visible`
`position`

### `opportunities`
`id, title, organiser, type (Grant|Residency|Commission|Open Call|Prize|Display|Job/Employment|Studio/Space|Public Art)`
`description, caption, full_description, country, city`
`opens_at, deadline, url, slug`
`funding_amount, funding_range, grant_type, recipients_count`
`featured_image_url, sub_categories[]`
`routing_type (external|pipeline), custom_fields[]`
`is_featured, is_active, status (pending|published|rejected), view_count`

### `project_updates` (studio feed)
`id, artist_id, project_id`
`content_type, discipline`
`image_url, audio_url, video_url, text_content, embed_url, embed_provider`
`caption, orientation`

### `opportunity_applications`
`id, opportunity_id, artist_id`
`status (pending|shortlisted|selected|approved_pending_assets|production_ready|rejected)`
`custom_answers {}, artwork_id, submitted_image_url, highres_asset_url`

### `messages`
`id, conversation_id, sender_id, content, is_read`
`message_type (text|transfer_request|transfer_accepted)`
`work_id → artworks(id) ON DELETE SET NULL`

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

**CI**: GitHub Actions matrix runs 4 parallel jobs (`tier: [1,2,3,4]`), each with 55-minute timeout. Do NOT run all sources in a single job — it will time out.

**Source definition** (`scraper/sources/index.ts`):
```typescript
{
  name: "Creative NZ",
  url: "https://www.creativenz.govt.nz/...",
  country: "NZ",
  disciplines: ["visual_art", "music"],
  needsBrowser: false,     // true → Playwright; false → axios
  isRss: false,
  followLinks: true,       // fetch linked detail pages
  maxLinks: 10,
}
```

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
