# Future To-Do

## #12 · Campaign type registry

Replace the current single shopfront/showcase layout with a named type registry. Each campaign type is a fixed set of configurable components — "Shopfront" (hero/works/pricing), "Exhibition" (statement/gallery/dates), "Map trail" (locations/artworks/QR grid per location). When a new type is needed: describe the concept, scope it, build the type definition and renderer. No drag-and-drop — pick type, configure its components.

## #13 · Map trail campaign type

A campaign type where each location on a map corresponds to a physical artwork with its own QR code. Needs: map library (Mapbox or Google Maps), per-artwork coordinate data (lat/lng stored on artworks or campaign config), clustered QR generation per location, a map renderer on the live campaign landing page, and an admin UI to pin artworks to locations.

## #16 · Pipeline opportunity lifecycle — programme mode

Three-state lifecycle for pipeline opportunities: **Active** (applications open, post-selection config editable) → **Programme running** (applications closed, artists locked in, config locked, work underway) → **Archived** (feeds into followup tracker).

Needs: `programme_started_at timestamptz` column on `opportunities`; a "Close applications & start programme" button with confirm modal on `/partner/dashboard/[opportunityId]` that sets `is_active: false` + `programme_started_at = now()`; the dashboard flips from the applications review UI to a selected-artists programme view once that timestamp is set; post-selection config renders read-only in the edit form after transition. Programme view is essentially #14 below. Manual "Send reminder" per artist fires a DM immediately rather than waiting for cron.

## #14 · Selected artists programme tracker (partner)

A "Selected Artists" tab on `/partner/dashboard/[opportunityId]` showing only selected/approved artists with per-artist rows exposing: project thread updates (from `project_updates` where `projects.opportunity_id = opp.id`), a deadline field and "send reminder" button per artist, and an update-required indicator if no update has been posted since the deadline. Turns the partner page from a submission inbox into a live programme management tool.

## #15 · Project thread on campaign landing page

Surface the project thread on the campaign's live landing page (`/live/[slug]/[username]`). Reads `campaigns.hero_work_id`, fetches the linked project and its updates, renders the thread as a timeline section. Closes the loop between the artist's studio narrative and what the public sees.

## #17 · Edition provenance

When an edition (limited print, open edition) is sold, each physical copy needs its own provenance chain and ledger ID rather than sharing the parent artwork row. 

**Model:** Parent `artworks` row = the series/template record with base ledger ID `PTRN-2026-XXXX-XXXX`. At sale time, clone parent → new child `artworks` row with `parent_artwork_id`, `edition_number = N`, suffixed ledger ID `PTRN-2026-XXXX-XXXX-0002`. Originals (inventory = 1) keep existing flow — parent row IS the instance.

**Migrations needed:** `artworks.parent_artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL`; `primary_sale_transactions.edition_id uuid REFERENCES editions(id) ON DELETE SET NULL`; `ensureLedgerId` called on parent at artwork creation time.

**Sale flow changes:** `completePrimarySale` reads `edition_id` from sale record → fetches edition (`edition_size`, `inventory`) → decrements inventory → calculates instance number → clones parent → generates suffixed ledger ID → inserts `created` + `transferred` ledger entries on clone → sets parent `is_available = false` when inventory hits 0.

**Provenance page:** if artwork has `parent_artwork_id`, show "Edition N of M" pill + link to parent. Race condition on concurrent purchases: use atomic inventory decrement with optimistic locking.

## #18 · Artwork series

A series groups related but distinct artworks (e.g. "Coastal Series") under a single hub page, without affecting each work's independence, price, or provenance.

**Studio UX:** `/studio?section=works` gets two entry points — "Add Series" (new) alongside the existing "Add Artwork" (unchanged). Creating a series: upload a hero image, write title/description, then pick existing artworks from the artist's catalogue and drag to order.

**Data model:** `series` table (`id`, `artist_id`, `title`, `slug`, `hero_image_url`, `description`, `created_at`); `series_artworks` junction (`series_id`, `artwork_id`, `position`). An artwork can belong to multiple series.

**Public series page** at `/[username]/series/[slug]`: hero image, title, description, grid of all works each with their own for-sale pill and buy modal. Each work retains its own detail page and `PTRN-XXXX` provenance certificate. Lightbulb tip on setup: "A series groups related works under one URL. Each piece keeps its own page, price, and provenance certificate."

Note: supporting images on individual artwork detail pages (multiple angles, documentation photos) are a separate system and remain unchanged.

## #22 · Stripe Connect required for campaign product/print sales

Campaigns that sell physical products, prints, or originals (i.e. any campaign with a Stripe checkout flow) must require the artist to have completed Stripe Connect onboarding before activation. Gate the campaign activation ("coming soon") button on `stripe_connect_status === 'enabled'` — show a "Connect your Stripe account first" prompt if not connected. Same pattern as the works listing gate added to `edition-actions.ts`.

## #19 · Stripe Adaptive Pricing

Enable Adaptive Pricing so buyers outside NZD/AUD see prices in their local currency, with Stripe handling conversion and settling in the artist's currency. Already on the Checkout Sessions API — just add `adaptivePricing: { allowed: true }` to `CheckoutElementsProvider` options in `src/components/profile/StripeCheckoutPanel.tsx`. No backend changes needed.

## #20 · Secondary market (patron resale)

Allow patrons to re-list and sell collected works to other patrons or collectors via Patronage.

**Eligibility:** Only works acquired through Patronage's provenance system (`collection_membership.source_type = 'directly_from_artist'` or `'negotiated_sale'`) — not self-recorded collector uploads — since provenance integrity is required for the secondary ledger chain.

**Model changes:** `artworks` needs a `resale_price_cents` + `resale_currency` + `is_resale_listed` flag; or create a separate `resale_listings` table referencing `artwork_id` + `current_owner_id`. Ledger entry type `resale` already exists in the schema.

**Commerce flow:** mirrors the primary-sale flow — Stripe Checkout, commission taken at transaction, ledger entry on completion, `current_owner_id` flips to buyer, `collection_membership` row moves to new buyer.

**UI surfaces:** "Re-list this work" CTA on `/dashboard/collection/[id]`; resale works surfaced on artist's public profile (so artist retains attribution / discovery benefit) with a "Secondary market" badge. Patron's public collection page shows resale price if listed.

**Policy:** Patronage takes the same 10% commission as primary sales. Artist does not receive a royalty cut in MVP — add that in a future pass once artist contracts are formalised.

**Build trigger:** After primary-sale commission is live and at least one patron has confirmed interest in reselling.

## #21 · "Hide this" per card on For You tab

Skip the feedback widget for MVP. Add a "Hide this" button per card on the For You opportunities tab once there are enough users to assess whether matches are landing well. Hiding is actionable immediately — store a `hidden` flag on `opportunity_artist_matches` and filter it out of `getMatchedOpportunities`. No re-scoring loop required.

---

## #23 · Exportable pipeline data for external CRMs

Let partners who run their intake/relationship management in an external CRM (e.g. Monday, and Monday forms) get applicant/submission data out of the pipeline dashboard so they can import it into their own tools. The data already exists: `opportunity_applications` (status, applicant profile, answers, entry-fee/payment state) aggregated on `/partner/dashboard/[opportunityId]`.

**Options, cheapest → richest:**
1. **CSV/Excel export button** (the 80/20 answer) — a server route that streams the partner's applications, respecting their active filters (opportunity, status, date), as CSV. Monday imports CSV into a board cleanly. Snapshot, not sync; no external accounts or API keys.
2. **Shareable export link / scheduled email** — same CSV behind a stable link or a weekly emailed export (reuse Resend + cron). Good for partners who don't want to log in to pull data.
3. **Generic webhook ("send to Zapier/Make")** — fire an event on new submission / status change to a partner-configured webhook URL; partner wires "new row → Monday item" via Monday's native Zapier/Make connectors. Stays CRM-agnostic (Monday, HubSpot, Airtable…) with one feature.
4. **Direct Monday integration** — push items into a board via Monday's GraphQL API or forms/webhooks. Most seamless but a real per-CRM integration: token storage per partner, board/column mapping UI, error handling. Only worth it once several partners specifically ask for Monday.

**Decisions regardless of approach:**
- **Field mapping** — which columns (applicant name/email, discipline, status, submission date, answers, payment status). Free-text answer fields are the messy part for a rigid CRM schema.
- **PII / consent** — exporting applicant contact info to a third-party CRM has privacy implications; add a line to terms and gate exports to the opportunity's owning partner only.
- **Snapshot vs sync** — CSV is a snapshot; webhooks/API give ongoing sync. Most partners are fine with snapshots early on.

**Recommendation:** start with #1 (CSV export); add #3 (webhook) later if partners want automation. Skip #4 until there's clear demand for Monday specifically.

---

## #24 · Connect the silos — six features + personalised weekly digest

*Fully scoped July 2026 — ready to implement when picked up. Approved direction: all six, with the digest personalised per user via `opportunity_artist_matches`.*

**Why:** the engagement features (follows, saves, studio updates, commissions) capture user intent but never act on it — notifications only fire from commerce handlers, all emails are transactional, and the weekly digest ignores `profiles.weekly_digest` entirely (it only sends one generic email to the anonymous `subscribers` table, so the settings toggle currently does nothing).

**Bonus fixes found during scoping:**
- **Latent bug:** in `src/app/partner/dashboard/actions.ts` (~lines 188–207), marking an application `selected` already tries to auto-create a project but silently fails — `upsert(..., { onConflict: "artist_id" })` has no matching unique constraint, and the seed insert uses a nonexistent `body` column. Feature 6 below replaces this block.
- **Settings gap:** the `weekly_digest` toggle writes a column nothing reads. Feature F6 makes it real.

**Verified facts (don't re-derive):**
- `notifications` type CHECK is `notifications_type_check` (drop/re-add pattern precedent: migration 163). **No INSERT RLS policy** → all inserts must go through the admin client in server actions/routes; every fan-out action must verify ownership first or any user could spam followers.
- `NotificationBell.tsx` types its icon map off `Notification["type"]` — TS enforces icon completeness. `src/lib/notifications.ts` has a duplicate `NotificationType` union; update both.
- `CreateUpdateModal.tsx` inserts `project_updates` **client-side** (~line 270) and never sets `update_tag` (defaults `'update'` in `src/lib/feed.ts:58`). Fan-out needs a post-insert server action. Same for `AddAvailableWorkModal.tsx` (~line 143).
- Artwork prices are **cents** (`price_cents`, `price_currency`, `is_poa`) — format via `formatPrice()` in `src/lib/format-price.ts`. Work links: `/${username}/works/${slug ?? id}`.
- `FollowButton` takes `followingId`, `initialIsFollowing`, `isAuthenticated` — usable as-is on `/sale/success`.
- `projects` already has `opportunity_id`/`artwork_id` columns, but `getArtistProjects`/`getThread` (`src/lib/projects.ts`) hardcode/omit them.
- "For You" matching = `opportunity_artist_matches` (score 0–100 + reason per artist×opportunity), populated by `scraper/score-matches.ts` via GitHub Actions after each scrape; UI threshold 70 via `getMatchedOpportunities()`.
- Digest: `/api/admin/send-digest` (Tue 22:00 cron) + `src/lib/digest.ts` (`getDigestData()`, `oppRow`/`sectionHeader` builders, `resend.batch.send` 100-chunks, `subscribers.unsubscribe_token`).
- Commissions toggle saves via `updateProfile` in `src/app/onboarding/actions.ts` gated by `has_commission_fields` — never reads the prior value, so detecting the false→true flip needs a pre-read.
- `user_saved_opportunities`: status `'saved'|'applied'`, unique (user, opportunity); no reminder-tracking columns yet.

**Migrations** (renumber from latest when picked up; #1 must run before deploying any new-type insert code):
1. **notification_types** — drop/re-add `notifications_type_check` with superset `('sale','support','transfer_request','transfer_accepted','note','follow','new_work','commissions_open','deadline')`.
2. **deadline_reminders** — `user_saved_opportunities` + `reminded_week_at timestamptz`, `reminded_final_at timestamptz`; `profiles` + `deadline_reminders boolean NOT NULL DEFAULT true`.
3. **project_updates_artwork** — `project_updates` + `artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL` + partial index.
4. **projects_artist_opportunity_unique** — `CREATE UNIQUE INDEX ... ON projects(artist_id, opportunity_id) WHERE opportunity_id IS NOT NULL` (enables the idempotent upsert the partner-select code intended).

**Steps (each independently shippable, in order):**

**Step 0 — notification foundation** (migration 1): extend `NotificationType` in `src/lib/notifications.ts` AND `src/types/database.ts`; add `createNotificationsBulk(rows)` (single admin `.insert(rows)`); NotificationBell icons — follow: UserPlus, new_work: ImagePlus, commissions_open: Brush, deadline: Clock.

**Step 1 — follow → notify artist:** in `followArtist` (`src/actions/follows.ts`), on success fire-and-forget `createNotification(followingId, "follow", "<Name> started following you", null, "/<followerUsername>")`. Guard self-follow; dedup: skip if same-link `follow` notification exists in last 7 days (prevents follow/unfollow toggle spam).

**Step 2 — saved-opportunity deadline reminders** (migration 2): new `src/app/api/cron/send-deadline-reminders/route.ts` (auth scaffold from `send-update-reminders`, `maxDuration = 300`). Admin query: `status='saved'` joined to opportunities with deadline in [today, +7d]; two buckets — **week** (`reminded_week_at IS NULL`) and **final** (≤2d, `reminded_final_at IS NULL`). Group by user, bulk-fetch profiles, emails via `admin.auth.admin.getUserById`. Per user: in-app `deadline` notification (always, link `/dashboard`) + email (only if `deadline_reminders !== false`) via new `src/lib/deadline-reminders.ts` reusing `oppRow`/`sectionHeader` exported from digest.ts. Stamp `reminded_*_at` after send (also for email-opted-out users so in-app doesn't repeat). Settings: `DeadlineRemindersToggle` (clone `DigestToggle.tsx`) + `updateDeadlineReminders` action in `src/app/profile/privacy-actions.ts`. vercel.json: `{ "path": "/api/cron/send-deadline-reminders", "schedule": "0 21 * * *" }` (≈09:00 NZT).

**Step 3 — post-purchase follow + collections count** (no migration): `/sale/success` — resolve session user via server client; if logged in and not the artist, render "Follow <artist> to see new work first" with existing FollowButton (logged-out/shadow buyers: nothing extra, claim CTA covers them). Profile (`src/app/[username]/page.tsx`) — add to the parallel fetch `artworks.select("current_owner_id").eq("creator_id", id).neq("current_owner_id", id).not("current_owner_id","is",null)`; `collectionsCount = new Set(owner ids).size`; render "Held in N collections" (N>0 only) near the badges.

**Step 4 — studio updates ↔ artworks** (migration 3): `ProjectUpdate.artwork_id` in types + minimal `artwork` object on the feed row (only id, slug, title, price_cents, price_currency, is_poa, is_available). `CreateUpdateModal`: tag selector chips (Concept / Update / Milestone / **New work** → `'concept'|'update'|'milestone'|'complete'`, default `'update'`), include `update_tag` in insert; when `'complete'`, optional "Attach a work" picker of own available artworks → `artwork_id`. `src/lib/feed.ts`: add `artwork_id` + `artworks:artwork_id (…)` to the select. `FeedCard`: when `artwork?.is_available`, footer CTA "Available · NZD 1,200 →" via `formatPrice()`, link to work page, `stopPropagation`.

**Step 5 — new-work + commissions-open fan-out** (needs steps 0 & 4): new `src/actions/notify-followers.ts` (`"use server"`), ownership-verified (server client auth check → admin fan-out via `createNotificationsBulk`, exclude self): `notifyFollowersOfUpdate(updateId)` (verify owner + `update_tag==='complete'`, dedup by link), `notifyFollowersOfArtwork(artworkId)` (verify creator + available, dedup by link), `notifyFollowersCommissionsOpen()` (30-day dedup window). Hooks: `CreateUpdateModal.handlePost` (change insert to `.insert().select("id").single()`, fire when complete); `AddAvailableWorkModal` after available-artwork insert; `updateProfile` in onboarding/actions.ts — pre-read `open_for_commissions`, fire on false→true flip. Skip other artwork insert sites (editions/series/provenance/archival — archival rows are `is_available=false`).

**Step 6 — applications ↔ project threads** (migration 4): in `updateApplicationStatus`, **replace** the broken block — upsert `{ artist_id, title: opp.title, opportunity_id: opp.id }` with `onConflict: "artist_id,opportunity_id", ignoreDuplicates: true` (if null returned, select by pair); seed post with correct columns `{ project_id, artist_id, content_type: "text", text_content: "Selected for <title> (<type>)" }` (no `body`). `src/lib/projects.ts`: select real `opportunity_id`/`artwork_id` in `getArtistProjects` + `getThread`; `getThread` fetches `opportunities (id, title)` when linked. `src/app/threads/[id]/page.tsx`: "Commissioned via <opportunity link>" line under the header. `partner/dashboard/[opportunityId]`: bulk-fetch projects for the opportunity, "View project thread →" on selected artists' rows.

**Step 7 — personalised weekly digest** (no migration; biggest): in `src/lib/digest.ts` (generic path stays intact for `subscribers` + `sendWelcomeDigest`): `getPersonalisedDigestBulk(userIds, generic)` — admin client, **4 bulk queries total, no per-user N+1**: (1) saved opps closing ≤14d `.in(user_ids)`; (2) matches score≥70 `.in(artist_ids)` restricted to this week's new opportunity ids; (3) `follows` `.in(follower_ids)`; (4) `project_updates` `update_tag='complete'` last 7d `.in(all followed ids)` with artist join — chunk `.in()` lists at ~200 ids; group per user into `{ savedClosing, matchedNew, followedWork }`. `buildPersonalisedDigestHtml(...)` reuses `oppRow`/`sectionHeader`/shell — personal sections first ("Your saved opportunities closing soon", "New this week, matched to you", "New work from artists you follow"), generic sections fill when personal empty; do NOT refactor email.ts into a shared wrapper. Rework `/api/admin/send-digest` (`maxDuration = 300`): recipients = profiles `weekly_digest=true` (emails via `admin.auth.admin.listUsers` **pagination**, not per-user getUserById) + `subscribers`, dedupe by lowercased email (profile wins → personalised; subscriber-only → generic + token unsubscribe); `getDigestData()` once → bulk personalisation once → per-recipient HTML in memory; matched section artists-only; send via existing `resend.batch.send` 100-chunks, counting per-item results (current code marks a whole chunk failed); profile users' footer links "Manage email preferences" → `/settings`.

**Verification per step:** `npx tsc --noEmit` + `npm run build` after each. Step 0: insert one row of each new type in SQL editor → bell renders + realtime increments. Step 1: follow from second account → bell fires; refollow → no duplicate. Step 2: seed saved opp with deadline in 3 days → `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/send-deadline-reminders` → email + bell; second run sends nothing. Step 3: sold-works profile shows "Held in N collections"; test purchase logged-in shows follow prompt, logged-out doesn't. Step 4: "New work" update with attached work → CTA in feed, link correct. Step 5: post new work / list work / flip commissions with a follower watching → bell each, no duplicates on repeat. Step 6: select an application → project auto-created, thread shows "Commissioned via", partner page links thread, re-select idempotent. Step 7: account with weekly_digest=true + saved closing opp + ≥70 match + followed artist with fresh complete update → curl digest route → all three personal sections; subscribers-only address still gets generic.

---

## #11 · Analytics dashboard

**Trigger:** Build when there are 50+ artists with at least 10 completed sales across the platform. Below that threshold, the earnings dashboard is sufficient and a chart with 3 data points is noise, not signal.

**What to show:**
- Revenue over time (monthly, per artist)
- Inventory value (sum of available works at listed price)
- Collector geography (map view of `current_owner_id` profiles by region)

**Foundation:** The Stripe earnings dashboard. Build on top of existing transfer/sale data in `artworks` and `messages`.

---

## #25 · "NZ art for sale" SEO — remaining structural work

**Context:** Long-tail commercial SEO for queries like "nz art for sale", "mixed media art for sale nz". Competitors: The Poi Room, Look NZ, Fishmob, Saatchi Art NZ. Realistic timeline 3–6 months; win the long-tail first, the head term follows. **Already shipped (2026-07):** dedicated server-rendered `/works` page with indexable H1 + intro copy + title/meta (replaced the old `/works → /feed?tab=works` rewrite); Product JSON-LD (price/availability/image) on `/[username]/works/[slug]` detail pages (these were already SSR with generateMetadata). `/works` is already in the sitemap.

**Remaining:**

1. **Category landing pages** — the real long-tail weapons: `/works/paintings`, `/works/contemporary`, `/works/mixed-media`, `/works/sculpture`. Each = the `/works` grid with a `medium_category` filter pre-applied + a unique title tag, H1, and 2–3 sentences of descriptive copy. Decision needed before building: static `/works/[category]/page.tsx` with a hardcoded slug→`medium_category`→copy map (recommended — controllable copy, `generateStaticParams`), vs a generic filtered view. Requires confirming the actual `medium_category` taxonomy values in the DB so slugs map to real filters. Titles e.g. "Paintings for Sale NZ | Patronage", "Mixed Media Art for Sale NZ | Patronage".

2. **Purchase-intent blog posts** (content, needs Blake's copy or sign-off — don't auto-generate): "How to buy art from NZ artists online", "What to look for when buying original art in NZ", "Emerging NZ artists to watch in 2026", "How to commission a NZ artist". Each links to `/works` and specific artist profiles to build topical authority around "NZ art".

3. **Internal linking:** footer "Works for Sale" / "Buy Art" link → `/works` (Footer.tsx); every artist profile links to their works-for-sale; home feed preview already surfaces work-for-sale pins (WorkSalePin) — keep. Anchor text matters.

**Note:** the Explore "For sale" filter tab and `WorksControls`/`SupportWorks` already point at `/works`, so the new dedicated page is the canonical for-sale surface (parallel to `/artists`, `/opportunities`). The feed's own `?tab=works` branch is now vestigial (still functional, shares the `getAvailableWorksForGrid` lib) — safe to remove later if desired.
