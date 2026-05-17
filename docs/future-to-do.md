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

## #11 · Analytics dashboard

**Trigger:** Build when there are 50+ artists with at least 10 completed sales across the platform. Below that threshold, the earnings dashboard is sufficient and a chart with 3 data points is noise, not signal.

**What to show:**
- Revenue over time (monthly, per artist)
- Inventory value (sum of available works at listed price)
- Collector geography (map view of `current_owner_id` profiles by region)

**Foundation:** The Stripe earnings dashboard. Build on top of existing transfer/sale data in `artworks` and `messages`.
