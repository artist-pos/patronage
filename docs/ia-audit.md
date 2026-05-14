# Patronage — Authenticated Routes Audit

_Generated May 2026. Read-only audit for IA redesign purposes._

---

## Role system

Four roles, set once at signup, cannot be changed:
- **artist / owner** — studio access, provenance, campaigns, earnings
- **patron** — dashboard, collection, messages, saved opportunities
- **partner** — partner dashboard, pipeline management
- **admin / owner** — everything above plus `/admin/*`

Nav visibility: `isArtist = role === "artist" || role === "owner"`, `isPartner = role === "partner" || role === "admin"`

---

## STUDIO (`/studio`)

**Access:** artist, owner only. Redirects others to `/dashboard`.

The studio is a single-page shell at `/studio?section={id}` — all sections are tabs within one layout, except for four routes that are separate full pages: `/studio/provenance`, `/studio/provenance-settings`, `/studio/rooms`, `/studio/pending-confirmations`, `/studio/earnings`, `/studio/connect`, `/studio/campaigns/new`, `/studio/campaigns/[id]`, `/studio/artworks/[id]`.

**Sidebar: 14 sections across 4 groups**

| Group | Section ID | Label | Route |
|---|---|---|---|
| Identity | `profile` | Profile | `/studio?section=profile` |
| Identity | `cv` | CV & History | `/studio?section=cv` |
| Work | `portfolio` | Portfolio | `/studio?section=portfolio` |
| Work | `available` | Available | `/studio?section=available` |
| Work | `sold` | Sold | `/studio?section=sold` |
| Work | `collection` | Collection | `/studio?section=collection` |
| Creative | `updates` | Studio Updates | `/studio?section=updates` |
| Creative | `projects` | Projects | `/studio?section=projects` |
| Commerce | `campaigns` | Campaigns | `/studio?section=campaigns` |
| Commerce | `support` | Support Tiers | `/studio?section=support` |
| Commerce | `provenance` | Provenance | `/studio/provenance` |
| Commerce | `confirmations` | Confirmations | `/studio/pending-confirmations` |
| Commerce | `rooms` | Viewing Rooms | `/studio/rooms` |
| Commerce | `earnings` | Earnings | `/studio/earnings` |

Note: Provenance, Confirmations, Rooms, and Earnings are listed in the sidebar but navigate to separate full-page routes rather than tab panels. Earnings has no sidebar entry in sidebar-config.ts but `/studio/earnings` is a real route.

**Profile completion gate:** `provenance` and `campaigns` are locked until the profile has name, location, bio, avatar, and at least one work. A banner on every studio page shows missing fields with direct links. `SectionLockGate` renders a blocked state instead of content.

---

### Profile section (`/studio?section=profile`)

**Queries:** `profiles` (all editable fields), `collective_members + collectives` join, `portfolio_images` (featured count), `engagement_logs` (view counts)

**Actions:**
- Edit name, bio, location, website, social links, disciplines, career stage, support enabled toggle
- Upload avatar (400×400px, WebP pipeline)
- Upload featured image (landscape banner)
- Manage email preferences (weekly digest toggle)
- Manage collectives (create, join, manage members)
- Terminate account (danger zone)

**Primary feature.** Collectives management is buried here — no dedicated sidebar entry.

---

### CV & History section (`/studio?section=cv`)

**Queries:** `profiles` (exhibition_history, press_bibliography, received_grants, cv_url, professional_cv_url)

**Actions:**
- Upload public CV (PDF)
- Upload professional CV (private, only shared with partners on pipeline applications)
- Add/edit/delete exhibition history entries (solo/group, with dates and venue)
- Add/edit/delete grants/awards received
- Add/edit/delete press and bibliography entries

**Primary feature.** The distinction between public CV (PDF upload) and structured exhibition history is not explained to the user — both exist in parallel.

---

### Portfolio section (`/studio?section=portfolio`)

**Queries:** `portfolio_images` (archival works, `is_available=false`), `engagement_logs` (view/play counts per work)

**Actions:**
- View archival portfolio items with featured status
- Featured count indicator (0–8 works)
- Reorder by position
- Add portfolio work button

**Primary feature.** Archival-only — no price, no sale. Separate from Available.

---

### Available section (`/studio?section=available`)

**Queries:** `artworks` (is_available=true, creator_id=user.id, with price, currency, listing_mode)

**Actions:**
- Add work for sale (opens NewArtworkEditor)
- Edit work price, currency, listing mode (direct sale / enquire first)
- Hide/show works from public
- Unlist works
- Mark as collected
- Generate documents (COA, tear sheet, wall label, consignment) — via lightbox

**Primary feature.** The lightbox on each work shows: price, medium, location, manage actions, generate documents.

---

### Sold section (`/studio?section=sold`)

**Queries:** `artworks` (creator_id=user.id, current_owner_id != user.id)

**Actions:** Read-only. Shows buyer info and transfer date.

**Secondary.** No actions available. No link to provenance details for individual sold works.

---

### Collection section (`/studio?section=collection`)

**Queries:** artworks the artist currently owns (current_owner_id=user.id)

**Actions:** Manage works they've collected (received as gifts or purchases from other artists).

**Secondary.** Exists in studio sidebar but same concept as `/dashboard/collection`. Overlap with dashboard.

---

### Studio Updates section (`/studio?section=updates`)

**Queries:** `project_updates` via `getArtistUpdates()`, `projects` via `getArtistProjects()`

**Actions:**
- Post studio update (text, image, audio, video, embed)
- Assign update to a project
- Delete update

**Primary feature.**

---

### Projects section (`/studio?section=projects`)

**Queries:** `projects`, `project_updates`

**Actions:**
- Create project (title, description)
- View project thread
- Associate updates with projects
- Delete project

**Primary feature.** Closely related to Studio Updates — they share the same data. Split into two sidebar entries.

---

### Campaigns section (`/studio?section=campaigns`)

**Queries:** `campaigns` (artist_profile_id=user.id, all columns)

**Actions:**
- View campaign list with status (live, completed, draft)
- Create new campaign (→ `/studio/campaigns/new`)
- Configure campaign (→ `/studio/campaigns/[id]`)
- Delete campaign

**Locked** behind profile completion. Primary feature.

---

### Campaign detail (`/studio/campaigns/[id]`)

**Queries:** `campaigns`, `campaign_files`, `portfolio_images`

**Actions (CampaignConfigPanel):**
- Set title, dates, location
- Select hero artwork + additional works (max 6)
- Set layout mode (shopfront / showcase)
- Set per-work pricing (original, prints, POA)
- Upload production files (partner campaigns only)
- Download QR assets ZIP (per-work QRs + collection QR + labels.csv)
- Regenerate QR code
- Publish storefront / Submit for partner approval

**Primary feature.**

---

### Support Tiers section (`/studio?section=support`)

**Queries:** `support_tiers` (profile_id=user.id)

**Actions (SupportTiersManager):**
- Create tier (title, description, price, type: one_off/monthly)
- Upload tier image
- Edit tier
- Delete tier
- Toggle sort order

**Primary feature.**

---

### Provenance (`/studio/provenance`)

**Queries:** `artworks` (transferred works), `profiles` (logo, signature, theme), `artwork_provenance_ledger`, `artwork_documentation_photos`, `profiles` (buyer names)

**Actions (ProvenanceList):**
- View transferred works with buyer info
- View documentation photo count per work (n/4)
- Navigate to provenance settings
- Navigate to `/studio/artworks/[id]` to manage individual work docs

**Locked** behind profile completion. Primary feature.

---

### Provenance Settings (`/studio/provenance-settings`)

**Queries:** `profiles` (provenance_logo_url, provenance_signature_url, theme, colors, font, orientation)

**Actions:**
- Upload logo
- Upload signature (private bucket)
- Select template theme (minimal, editorial, gallery)
- Customise primary/accent colour
- Select font pair
- Select orientation (portrait/landscape)
- Live preview of certificate

**Settings-type page.** No sidebar entry — only reachable from the Provenance section.

---

### Artwork detail (`/studio/artworks/[id]`)

**Queries:** `artworks` (full row), `profiles` (username), `artwork_documentation_photos`, `artwork_provenance_ledger`

**Actions (WorkDetailsEditor):**
- Edit title, medium, year, dimensions, edition fields
- Edit price, currency, listing mode
- Edit location + show publicly toggle
- Upload documentation photos (front, back, detail, scale, installation)
- View provenance ledger entries
- Add prior history entries (exhibited, sold, gifted, commissioned, published, other)
- Generate documents (COA, tear sheet, wall label, consignment) — via API route

**Primary feature.** Only reachable by clicking "Edit" on a work in the Available section or Provenance list — no direct nav entry.

---

### Pending Confirmations (`/studio/pending-confirmations`)

**Queries:** `getPendingConfirmationsForArtist(user.id)`, artist stubs for name matching

**Actions (PendingConfirmationsList):**
- Confirm work attribution ("Yes, I created this")
- Decline ("No, not me")
- Defer ("I'm not sure")

**Secondary.** Has a notification dot in sidebar when pending. Empty state has no guidance on why these appear or how to get more.

---

### Viewing Rooms (`/studio/rooms`)

**Queries:** `private_rooms`, `artworks` (available, for selection), `private_room_artworks` (counts)

**Actions (RoomsManager):**
- Create room (title, slug, description, show_prices toggle)
- Select artworks for room
- Copy share URL
- Toggle active/inactive
- Delete room

**Primary feature.**

---

### Earnings (`/studio/earnings`)

**Queries (admin client):** `primary_sale_transactions`, `royalty_holds`, `support_subscriptions`, `artworks` (for titles)

**Actions:**
- View primary sales table (work, price, artist take, payout status)
- View resale royalties
- View support payments
- Banner to connect bank if Stripe Connect not enabled

**Primary feature. No sidebar entry in sidebar-config.ts** — reachable only via direct URL or banner link from other pages. This is a bug in the IA.

---

### Connect Bank (`/studio/connect`)

**Queries:** `profiles` (stripe_connect_status)

**Actions:** Start Stripe Connect OAuth. Success confirmation if already connected.

**Settings-type page.** No sidebar entry — reachable only from the Earnings page banner.

---

## DASHBOARD (`/dashboard`)

**Access:** All authenticated users. Artists, patrons, and partners all land here.

**Tab structure** (role-conditional):

| Tab | Roles | Label |
|---|---|---|
| overview | all | Overview |
| closing | all | Closing soon |
| saved | all | Saved |
| applied | all | Applied |
| applications | all | Applications |
| expired | all | Expired |
| analytics | artist, owner | Analytics |
| campaign-reports | artist, owner | Campaign reports |
| notes | all | Notes |
| subscriptions | all | My Support |

---

### Overview tab

**Queries:** `saved_opportunities`, `opportunity_applications`, `provenance_links` (patrons), `profile_view_logs` (artists, last 30 days)

**Displays:**
- 4 stat cards: saved opps, closing this week, applications, profile views (artist only)
- "Needs Attention": provenance links awaiting approval, applications needing asset upload, opps closing in 48h
- Closing soon preview (top 3 with OpportunityCard)

**Actions:** Links to relevant tabs/pages. No direct actions.

---

### Closing Soon / Saved / Applied / Expired tabs

**Queries:** `saved_opportunities` filtered by state

**Actions:** OpportunityCard with save/unsave. Applied shows status. Expired is read-only.

**Secondary** — filtered views of the same saved opportunities data.

---

### Applications tab

**Queries:** `opportunity_applications`, `opportunity_application_drafts`

**Actions:**
- View in-progress applications and drafts
- Upload high-res assets for approved applications (status = approved_pending_assets)
- Track status through pipeline (pending → shortlisted → selected → approved → production_ready)

**Primary feature** for artists and patrons applying to Job/Employment opportunities.

---

### Analytics tab (artists only)

**Queries:** `getProfileStats(user.id, days)` — profile views, artwork views, CV clicks, website clicks, followers, works added. `getFollowers(user.id)`.

**Actions:**
- Period selector (7d, 30d, 90d, all)
- Read-only charts

**Duplicate of `/profile/analytics`.** Two routes with identical content — one in the dashboard tab bar, one at its own URL.

---

### Campaign Reports tab (artists only)

**Queries:** `campaigns`, `campaign_events`

**Displays:** Per-campaign: scans, profile views, enquiries, sales counts.

**Actions:** Link to configure campaign. Read-only otherwise.

**Secondary.**

---

### Notes tab

**Queries:** `getMyWrittenNotes(user.id)` — notes on studio updates

**Actions:** Edit/delete notes, link to parent update.

**Secondary. Duplicate of `/profile/notes`.**

---

### My Support tab

**Queries:** `support_subscriptions` (supporter_id=user.id) joined with support_tiers and artist profiles

**Actions:** View active subscriptions, manage recurring (Stripe customer portal link).

**Primary feature** for patrons.

---

## PARTNER DASHBOARD (`/partner/dashboard`)

**Access:** partner, admin, owner. Others redirect to `/`.

**Admin vs partner view:** Admins see all opportunities. Partners see own + collaborator opportunities. Determined by `role === "admin" || role === "owner"`.

**No tab structure** — a single page with multiple sections.

---

### Live Pipelines section

**Queries:** `opportunities` (routing_type=pipeline) + `opportunity_applications` counts + `opportunity_collaborators`

**Displays:**
- Each pipeline opportunity: title, type, deadline
- Total applicants, "New" badge if pending > 0
- Partner name (admin view only)
- "Collaborator" badge if not owner

**Actions:** Link to `/partner/dashboard/[opportunityId]`

---

### All Listings section

**Queries:** `opportunities` all types, all statuses

**Displays:** Title, type, deadline, status (published/draft), partner (admin)

**Actions:**
- "Applications →" (pipeline + published only)
- "Edit →" (not collaborator only)

---

### Awaiting Review section

**Queries:** `opportunities` (status = pending or rejected)

**Actions:** Read-only. Shows "Under review" or "Rejected" state.

---

### Opportunity detail (`/partner/dashboard/[opportunityId]`)

**Queries:** opportunity full row, `opportunity_applications` with applicant profiles, `opportunity_collaborators`

**Actions:**
- Filter applications by status
- Move application through statuses (pending → shortlisted → selected → approved_pending_assets → production_ready → rejected)
- Download high-res asset (signed URL) when production_ready
- Message applicant
- View applicant CV (job/employment type only)
- Add/manage collaborators (admin/owner of opportunity only)
- Generate aggregate impact report → `/admin/opportunities/[id]/report`

**Primary feature.**

---

## PROFILE EDITING

**Route:** The main profile edit lives at `/onboarding/page.tsx` — the file is misnamed. The URL appears to be `/onboarding` (acting as profile edit post-onboarding). Studio's Profile section (`/studio?section=profile`) renders what appears to be the same or overlapping form.

**Profile editing exists in two places:** the Studio Profile section and a standalone `/onboarding` route. Confirmed overlap.

**Fields by role:**

| Field | Artist | Patron | Partner |
|---|---|---|---|
| Full name | ✓ | ✓ | ✓ |
| Bio | ✓ | ✓ | ✓ |
| Location | ✓ | ✓ | ✓ |
| Website | ✓ | ✓ | ✓ |
| Social links | ✓ | ✓ | ✓ |
| Disciplines | ✓ | — | — |
| Career stage | ✓ | — | — |
| Avatar | ✓ | ✓ | ✓ |
| Featured image | ✓ | — | — |
| Exhibition history | ✓ | — | — |
| Grants received | ✓ | — | — |
| Press bibliography | ✓ | — | — |
| Public CV (PDF) | ✓ | — | — |
| Professional CV | ✓ | ✓ (job apps) | — |
| Support enabled toggle | ✓ | — | — |
| Collectives | ✓ | — | — |
| Organisation type | — | — | ✓ |
| Charitable registration | — | — | ✓ |
| Donation URL | — | — | ✓ |
| collection_public toggle | — | ✓ | — |
| Email digest | ✓ | — | — |

---

## OTHER AUTHENTICATED ROUTES

### Onboarding Role (`/onboarding/role`)

**Access:** Logged in, no role set yet. Cannot be re-visited if role already set.

**Actions:** Select artist / patron / partner. Triggers role upsert, welcome email, welcome DM, subscriber insert for artists.

---

### Profile Analytics (`/profile/analytics`)

**Access:** All logged-in users.

**Duplicate of Dashboard Analytics tab.** Same queries, same layout. Reachable from profile page footer links.

---

### Profile Notes (`/profile/notes`)

**Access:** All logged-in users.

**Duplicate of Dashboard Notes tab.** Same queries. Reachable via direct URL only.

---

### Messages List (`/messages`)

**Queries:** `getConversations()` — conversations, other participant profile, last message content, unread count, source_work_id + artwork caption for enquiry threads.

**Actions:** Click to open conversation.

**No compose button** — conversations can only start from artist profile "Enquire" or "Message" buttons elsewhere on the site.

---

### Chat (`/messages/[conversationId]`)

**Queries:** conversation, both participant profiles, messages, source artwork (if enquiry), available works (if viewer is artist), work map for transfer messages.

**Actions:**
- Send text message
- Transfer work (artist only — TransferWorkButton)
- Accept gift transfer (patron only)
- Submit shipping address after accepting
- Make offer on source artwork (if enquiry thread + patron)
- Approve deletion request (artwork owner only)

---

## DUPLICATION & OVERLAP

| Duplicated feature | Location 1 | Location 2 |
|---|---|---|
| Analytics | `/dashboard?tab=analytics` | `/profile/analytics` |
| Notes | `/dashboard?tab=notes` | `/profile/notes` |
| Collection | `/studio?section=collection` | `/dashboard/collection` |
| Profile edit | `/studio?section=profile` | `/onboarding` (post-signup) |
| Projects + Updates | Two separate sidebar entries | Same underlying data |

---

## MISSING NAV ENTRIES (routes exist, no sidebar link)

- `/studio/earnings` — real route, no entry in sidebar-config.ts
- `/studio/connect` — real route, only reachable from earnings banner
- `/studio/provenance-settings` — real route, only reachable from provenance section
- `/studio/artworks/[id]` — real route, only reachable by clicking works in Available/Provenance
- `/profile/analytics` — real route, no persistent nav link (only in profile footer)
- `/profile/notes` — real route, no persistent nav link

---

## COUNTS

| Role | Studio sidebar items | Dashboard tabs | Other auth routes |
|---|---|---|---|
| Artist | 14 | 10 | /messages, /profile/analytics, /profile/notes, /feed, /opportunities |
| Patron | 0 | 8 | /messages, /profile/analytics, /profile/notes, /opportunities, /dashboard/collection |
| Partner | 0 | 8 | /partner/dashboard, /messages, /opportunities |
| Admin | 0 | 8 | /partner/dashboard, /admin (10+ sub-routes), /messages |
