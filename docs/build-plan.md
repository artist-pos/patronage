# Patronage — Build Plan

_Last updated: May 2026_

---

## What's already built (further along than it appears)

| Feature | Status |
|---------|--------|
| Campaigns | Auto-created on application → `selected`. Studio management pages, QR generation, email notification. **Missing: public-facing profile section.** |
| Profile achievements | Auto-written on `selected` / `approved_pending_assets`. Opportunity title, organiser, type, year. Partial CV update already done. |
| Artwork location field | `artworks.location_text` + `artworks.show_location_publicly` in schema. **Missing: UI on artwork edit form.** |
| Enquiry flow | `source_work_id` correctly set on conversations via `initializeInquiryThread`. Chat window shows pinned "Enquiry re: [work]" header. Working. |
| OCR (provenance lookup) | Tesseract-based scan already in `src/app/provenance/ProvenanceLookup.tsx`. Foundation for bulk import. |
| Edition (free text) | `artworks.edition text` exists. **Missing: structured `edition_number`, `edition_total`, `edition_type` fields.** |
| `collection_public` toggle | On `profiles`. **Missing: public-facing collection page for patrons.** |
| Document generation | `@react-pdf/renderer` + provenance cert templates + logo/signature per profile. **Missing: COA, tear sheet, wall label templates.** |

---

## Phase 1 — Build now

### #1 · Pipeline-to-inventory integration

**Why first:** One migration, one write in an existing action. Highest signal, lowest effort. Nobody else has both pipeline and provenance in the same platform.

**What it does:** When a partner marks an application as `selected`, and that application has an `artwork_id` attached, automatically write a provenance entry on that artwork recording the selection. The artist's CV and the artwork's history update without any double entry.

**Entry type:** `selected` — generic enough to cover grants, residencies, commissions, displays, and prizes. The opportunity type provides context. Rendered as:
> "Selected for [opportunity title] ([opportunity type])"

This reads correctly whether it's a grant ("Selected for Creative NZ Toi Uru Kahikatea (Grant)") or an exhibition ("Selected for City Gallery Open Call (Display)").

**Migration:**
```sql
-- Add 'selected' to the entry_type enum on artwork_provenance_ledger
ALTER TYPE artwork_provenance_entry_type ADD VALUE IF NOT EXISTS 'selected';

-- Add opportunity FK so the entry links to the live record, not just free text
ALTER TABLE artwork_provenance_ledger
  ADD COLUMN IF NOT EXISTS source_opportunity_id uuid REFERENCES opportunities(id);
```

**Code change:** `src/app/partner/dashboard/actions.ts` → `updateApplicationStatus`. Inside the `status === "selected"` block, after the achievements upsert — fire-and-forget admin write to `artwork_provenance_ledger` if `app.artwork_id` is set.

**Display:** Provenance page renders `selected` entries with opportunity title, type, organiser, and year. If `source_opportunity_id` is set, links to the live opportunity page.

---

### #2 · Campaign public page

**Why second:** The infrastructure is built and invisible. An artist gets selected, a campaign auto-creates, and nothing shows publicly. This is a display problem, not a build problem.

**What it shows:**
- Campaign title
- Partner / organiser name (linked to their profile if they're on Patronage)
- Opportunity type and dates
- What the campaign is for (opportunity description)
- Support CTA if `support_enabled` is true on the artist's profile

**What it doesn't show (yet):** Fundraising counter. Not all campaigns involve fundraising, and building a counter implies a specific funding model that doesn't apply universally. Add this later if needed.

**Where it lives:** A campaign section on `/[username]` — shown when the artist has an active campaign. Fetched server-side alongside the existing profile data. Conditional render, no new route needed for v1.

---

### #3 · Edition tracking (structured fields)

**Why now:** Ships with the next artwork form update. Three columns, minimal risk.

**Migration:**
```sql
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS edition_number integer,
  ADD COLUMN IF NOT EXISTS edition_total integer,
  ADD COLUMN IF NOT EXISTS edition_type text; -- 'AP', 'HC', 'PP', 'standard'
```

Keep the existing `edition text` field for free-form display (e.g. "3/10 AP"). The structured fields enable filtering, sorting, and proper provenance rendering. Display in: artwork lightbox info panel, provenance certificate, wall label template (when built).

---

## Phase 2 — Build soon

### #4 · Patron collection pages (v1)

**Scope — v1 only:** `collection_public` toggle on patron profiles + public grid of their collected works. This is not the full Barnes plan (trust tiers, confirmation loop, certificates, embed). That follows the phased plan from the earlier sessions.

**What's needed:**
- Public route: `/[username]?tab=collection` (or a collection section on the patron profile page)
- Query: `artworks WHERE current_owner_id = profile.id AND collection_visible = true`
- Render: justified grid (reuse `WorksJustifiedGrid` without owner actions)
- `collection_public` toggle wired to the patron profile edit page

**What's explicitly not in v1:** Trust tiers, ownership confirmation loop, COA generation for collection display, embed widget, secondary market.

---

### #5 · Support tier visual preview

**What's missing:** Artists can currently set a title, price, and text description for each support tier. They can't show an image — a photo of a print club edition, a render of equipment they're raising money for, a scan of what subscribers receive.

**Migration:**
```sql
ALTER TABLE support_tiers
  ADD COLUMN IF NOT EXISTS tier_image_url text;
```

**UI change:** Support tab renders tier cards with image + description instead of text-only list. Artist can upload an image per tier from the support tier edit form.

---

### #6 · Location field UI

**Schema is done.** `artworks.location_text` and `artworks.show_location_publicly` exist. This is purely a UI task:
- Input on artwork edit form: text field with placeholder suggestions ("Studio", "Storage", "Consigned at [gallery]", "On loan to [exhibition]")
- Toggle for public visibility
- Display in artwork lightbox info panel (owner always sees it; public sees it if `show_location_publicly = true`)

---

### #7 · Private viewing rooms

**What it is:** Artist selects a set of works, system generates a private URL. The URL is the secret. Useful for the Livingstone pitch (share an artist shortlist with a developer before going public), gallery previews, collector sharing with advisors.

**New tables:**
```sql
CREATE TABLE private_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (artist_id, slug)
);

CREATE TABLE private_room_artworks (
  room_id uuid REFERENCES private_rooms(id) ON DELETE CASCADE,
  artwork_id uuid REFERENCES artworks(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  PRIMARY KEY (room_id, artwork_id)
);
```

**Route:** `/rooms/[slug]` — no header, no footer, no auth required. Minimal justified grid. Contact CTA at the bottom linking to the artist's DMs. Prices shown only if artist enables them per room.

**Artist UI:** `/studio/rooms` — select works, set title, generate link, copy URL.

**Password protection:** Not in v1. The slug is the secret. Add optional PIN later if anyone asks — it's a one-field addition.

---

## Phase 3 — Build later

### #8 · Document generation (COA, tear sheet, wall label)

**Foundation:** `@react-pdf/renderer` already in use for provenance certificates. Logo and signature per profile already stored.

**New templates:**
- **Certificate of Authenticity (COA)** — title, medium, dimensions, year, edition, artist signature, Patronage provenance ledger reference
- **Tear sheet** — one-page gallery print: image, title, medium, dimensions, price, artist bio excerpt, contact
- **Wall label** — minimal: title, year, medium, dimensions, edition

**UI:** "Generate" dropdown on artwork lightbox info panel (owner only). Three options → server action renders PDF → download.

**All data already exists on artworks.** This is template work, not infrastructure work.

---

### #9 · Bulk import

**Two paths:**

**CSV upload**
- Route: `/studio/import`
- Artist uploads a spreadsheet; system maps columns (title, medium, year, dimensions, price, edition, location)
- Preview/confirm step before insert
- Bulk insert to `artworks`

**OCR scan import**
- Foundation: Tesseract already used in `src/app/provenance/ProvenanceLookup.tsx`
- Artist photographs existing inventory list or catalogue pages
- Tesseract extracts text → rule-based parsing maps to structured fields
- LLM (Haiku) used **only** as fallback for genuinely unstructured documents where rule-based parsing fails (handwritten ledger, non-standard catalogue format)
- Same preview/confirm step before insert

Ships alongside the full collection vault work (Barnes onboarding path).

---

### #10 · Provenance + exhibition manual linking

The automatic side is covered by #1 (pipeline-to-inventory). The manual side:
- When an artist adds a prior history entry to an artwork, give them a search-and-link field to attach it to an existing opportunity on Patronage
- Stores `source_opportunity_id` FK instead of free text
- Validates the opportunity exists; renders with a link to the live page

---

### #11 · Analytics dashboard

Post-100 artists. The data model is fine. At current scale there isn't enough data to make charts meaningful. Add visualisation (revenue over time, inventory value, collector geography) when there's substance to show. The Stripe earnings dashboard (Phase 2) is the foundation.

---

### #12 · Multi-user access (data model prep)

Not needed at current scale. When a gallery or established artist with a studio manager asks, the pattern is:

```sql
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,  -- the profile being managed
  granted_to_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,  -- the manager
  role text NOT NULL,  -- 'editor', 'viewer'
  permissions jsonb,
  created_at timestamptz DEFAULT now()
);
```

Create the table when convenient. Build the UI when someone specifically asks for it.

---

### Secondary market

Patron-initiated transfer (currently only artists can initiate). Same `transfer-actions.ts` flow, different `current_owner_id` check. Post-MVP. Build when the first patron asks to re-sell or re-gift a collected work.

---

## Don't build

| Feature | Reason |
|---------|--------|
| **Financial bookkeeping** | Hnry and Xero exist and are better. Pushing data to Hnry (the integration already explored) is the right answer — not replicating it. |
| **CRM / collector database** | Artlogic territory (£266/month for galleries). DMs, support tiers, and the collection system give artists enough collector visibility. Not your product. |
| **Condition reports** | Already noted in provenance doc as a future addition. Build when an institutional buyer or insurer asks. Nobody at current scale needs this. |

---

## What each role can do (current state)

### Artists
- Public profile: bio, CV, exhibition history, press bibliography, received grants, disciplines, career stage
- Portfolio (archival images), available works, sold works, studio feed, project threads
- List works: direct sale or enquire-first mode, per-work price/visibility controls
- Apply to pipeline opportunities; track status; upload high-res assets when selected
- Save and track external opportunities (closing soon / saved / applied / expired)
- DMs: receive enquiries linked to specific works, negotiate via offer cards, initiate transfers
- Support tiers (one-off and recurring via Stripe)
- Privacy controls: hide sold section, hide works from archive, hide prices

### Partners / Organisations
- List opportunities (all types: grant, residency, commission, open call, prize, display, job, studio/space, public art)
- External link or internal pipeline routing
- Custom application questions
- Review applications; move through status stages
- Request and download high-res production assets
- Access artist CVs for job-type opportunities

### Patrons / Collectors
- Browse profiles and studio feed
- Bookmark works
- Collect works (transferred by artists)
- DM artists with enquiries linked to specific works
- Make structured offers on works
- Apply to Job/Employment pipeline opportunities (with CV upload)
- Leave notes on studio updates and project posts
- Support artists via Stripe

### Not yet built for patrons
- Public collection page (`collection_public` toggle exists; display page in Phase 2)
- Secondary market (re-transferring collected works — post-MVP)
