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

---

## #11 · Analytics dashboard

**Trigger:** Build when there are 50+ artists with at least 10 completed sales across the platform. Below that threshold, the earnings dashboard is sufficient and a chart with 3 data points is noise, not signal.

**What to show:**
- Revenue over time (monthly, per artist)
- Inventory value (sum of available works at listed price)
- Collector geography (map view of `current_owner_id` profiles by region)

**Foundation:** The Stripe earnings dashboard. Build on top of existing transfer/sale data in `artworks` and `messages`.
