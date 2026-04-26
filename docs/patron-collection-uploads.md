# Patron-uploaded collections

A proposal for letting patrons (and partners — galleries, foundations, institutions) bring their existing collections onto Patronage, with public/private visibility per work and an embeddable "my collection" widget for their own websites.

The named target is **Andrew Barnes**. His personal site has had a "collection coming soon" placeholder for ~6 months. The premise: provide him a fully-functional public collection page he can embed on his own site, in less time than it would take his web team to build a custom one. Once Barnes ships, similar collectors follow because the bar is now visible.

This doc is product-shape, not implementation-detail. It assumes the existing provenance system from `provenance-system.md` is in place.

---

## The problem this solves

A patron-class collector (Barnes-shape: high-net-worth, deep portfolio, low engineering budget) has three things they cannot easily do today:

1. **Inventory their collection in one place.** Their works currently exist as a folder of paper certificates, gallery emails, and insurance schedules. Spreadsheets are common; a structured digital record is rare.
2. **Show their collection publicly.** Many collectors want to. Building a bespoke "collections" section on their own website is a 3-month project that nobody prioritises. Hence the perpetual "coming soon".
3. **Gradually graduate works onto Patronage's verified rails.** When an artist they collected from joins Patronage, the patron-uploaded record can be linked to the artist's verified record, and the work transitions from self-attested to platform-recorded.

Patronage is uniquely well-positioned because it already has the artwork data model, the provenance schema, the patron role, and the documentation-photo infrastructure. The patron-upload flow is a small extension of all of these — not a new product.

---

## The shape of the feature

### 1. Patron upload

In the patron's dashboard, a new "Add to my collection" flow with two paths:

- **Manual entry.** Title, artist (free text or, if the artist has a Patronage profile, link to it), medium, year, dimensions, edition, image upload, optional verso/signature/scale photos, optional prior history (exhibitions, prior owners, dates), optional source-document upload (scan of an existing certificate or invoice).
- **Scan import.** Photo of an existing paper certificate → OCR (the same `tesseract.js` already used for ledger lookup) prefills the form. Patron confirms, edits, saves. The OCR is form-prefill, never a verification step.

What gets created:

- A row in `artworks` flagged as patron-uploaded (new `source` enum: `artist_registered` | `patron_uploaded`).
- An `artwork_provenance_ledger` `created` entry — but its `to_owner_id` is the patron and its `transfer_method` is `claim` (or a new `imported` method). No `transferred` entry yet.
- A `patron_collection_membership` row tying the patron to the work, with `is_public` / `is_private` flags, position, and the date acquired (free-text, like `prior_history.date_text`).
- Any documentation/source photos uploaded into the existing `artwork_documentation_photos` infrastructure (private, gated).
- Any prior history entered into the existing `artwork_prior_history` table.

### 2. Trust tier — clearly labelled

This is the part that needs the most discipline. Patron-uploaded records are **self-attested by the patron**, not by the artist. The chain of custody on the public page must show this distinction at all times. Three explicit tiers:

| Tier | What it means | Visual cue |
| --- | --- | --- |
| **Recorded by artist** | Artist registered the work and signed transfers | the existing rendering |
| **Recorded by patron** | Patron uploaded the work; artist has not confirmed | `Self-attested` chip on every chain entry, distinct page banner |
| **Confirmed by artist** | Artist on Patronage has reviewed and confirmed the patron's upload of their own work | `Confirmed by artist` chip; the upload promotes to the same trust as artist-registered |

The trust-tier label should be visible at the top of the provenance page, next to "Recorded on Patronage", so a verifier can never misread a patron-uploaded record as artist-issued.

### 3. The artist-confirmation loop

This is the engine that makes patron-uploads actually credible over time, and it's why this doesn't have to be a parallel system — it's an extension of the existing claims rail.

When a patron uploads a work:

- If the artist already has a Patronage profile, the upload triggers a `pending_ownership_claim` from the patron's side, sent to the artist's dashboard. The artist sees: "Andrew Barnes says he owns this work of yours. Confirm / decline / unknown". Confirming promotes the record to `Confirmed by artist`. Declining marks the record as disputed. "Unknown" sits in limbo and the record stays `Self-attested`.
- If the artist has no Patronage profile yet, the patron-uploaded record stays `Self-attested` and is visible publicly with that disclaimer. When the artist later signs up, the system surfaces all unconfirmed patron-uploads referencing their name and prompts them to claim/confirm them in bulk.

This is the same pattern used today for buyers claiming works they hold from artists who already use Patronage. Re-using it means:

- No new auth model.
- No new email infrastructure.
- A pre-existing UI surface (artist's pending-claims tab) where confirmations land.
- A growth loop: every patron-uploaded work creates a small pull on artists to join and confirm.

### 4. Public / private toggle per work

Each `patron_collection_membership` has an `is_public` flag (default off). Public works appear on the patron's public collection page; private works only show in their dashboard. Toggle is one click on the row, no save dance.

This already partially exists on `profiles.collection_public` (a global toggle) and `artworks.collection_visible`. The patron-collection feature reuses these and adds nothing.

### 5. Public collection page

Route: `patronage.nz/{username}/collection` (we have `[username]` already). Renders only works where `is_public = true` AND the artwork's collection_visible isn't suppressed. Per-work tile shows: image, title, artist (linked if on Patronage), trust-tier chip, year, medium. Click opens the existing `/provenance/{ledger_id}` page.

Three meaningful design constraints:

- **The artist's name and link are non-removable.** Patron pages exist to show what was collected, not to obscure where it came from.
- **The trust-tier chip is non-removable.** A patron cannot re-skin a self-attested upload as a verified record.
- **`Powered by Patronage` mark is non-removable in the embed.** Same reason. The whole point is reputational adjacency.

### 6. Embeddable widget

Two delivery formats; ship both.

- **`<iframe src="patronage.nz/embed/{username}/collection">`** — simplest path, isolates styles, works everywhere. Set `X-Frame-Options: ALLOWALL` (or remove the global `DENY` for this route specifically) and a permissive frame-ancestors CSP. Configurable via query params: `?cols=4&theme=light&size=md`.
- **`<script src="patronage.nz/embed.js" data-user="..."></script>`** — modern path, renders inline so it inherits the host's typography, no scrollbars, looks bespoke. Heavier to maintain but is what Spotify, Pinterest, Instagram now offer. Build it second.

Both honour the `is_public` flag, both render the trust-tier chip, both link each tile back to `patronage.nz`. Caching is essential: the embed will be hit by every visitor to Barnes' homepage. Render once per change, serve from edge cache, invalidate on patron edits.

### 7. Resale, when it ships

When the resale flow lands (already on the provenance roadmap), patron-uploaded works gain a "transfer this work" option subject to the same artist-confirmation considerations: a `Confirmed by artist` upload can be transferred with a normal `resold` ledger entry. A `Self-attested` upload that's transferred should keep its self-attested nature on the chain — the transfer is recorded but the original record's trust tier doesn't get laundered by the act of selling it.

---

## Why Andrew Barnes specifically

A few attributes that make him the right first user:

- He has a personal website with an explicit "collection coming soon" gap. The pitch is concrete: "your placeholder, replaced, this week".
- Public profile of someone who actively talks about collecting and patronage. A working collection page on his site becomes an organic reference for other collectors.
- His collection includes NZ artists who are already (or close to being) on Patronage's radar. The artist-confirmation loop closes naturally for the works where it can.
- Low risk if the trust framing is clear from day one. He's not faking authentication — he's hosting a structured public inventory of works he owns.

The pitch language matters. Don't lead with "tokenise your collection" — that triggers crypto associations and isn't what's happening. Lead with: *"You've had a 'collection coming soon' page for six months. Replace it with one that's already live, verified by the artists where possible, and embeddable on your own site."*

---

## What this isn't

Three things this feature explicitly is not, to keep scope honest:

1. **It is not authentication.** A patron-uploaded record carries weaker weight than an artist-issued one, and the UI must always say so.
2. **It is not a marketplace.** Patron-collected works don't become sellable on Patronage by virtue of being uploaded. Resale, if/when it ships, is a separate flow with the artist-confirmation loop layered in.
3. **It is not a competitor to insurance schedules.** The data model overlaps but the use case is publication, not valuation. Don't add fields like "current value" or "insured for" — those create liabilities and don't earn their keep.

---

## Sequencing recommendation

If this is a roadmap item, the right order is:

1. **Resale flow first.** Without it, patron-uploaded works exist in a system that doesn't fully model what happens next when they're sold. Resale closes the loop.
2. **Patron upload, manual path only.** Form fields, RLS, public/private toggle, public collection page. No embed yet, no OCR yet. Get the data model right.
3. **Artist-confirmation loop wiring.** Reuse `pending_ownership_claims`. Add the trust-tier rendering on `/provenance/{ledger_id}`.
4. **OCR scan-to-import.** The infrastructure already exists from the verifier flow.
5. **Embed iframe.** Andrew Barnes goes live.
6. **Embed JS widget.** Higher fidelity for collectors who want it to look bespoke.

Steps 2–4 are roughly one engineer-week each. Step 5 is a few days. Step 6 is a few weeks because of the cross-host CSS surface. Steps 1 and 6 dominate the calendar; everything in between is tractable.

---

## Open questions worth resolving before building

- **Do partners (galleries, foundations) get the same flow as patrons, or a separate institutional-grade variant?** A gallery's "collection" is closer to inventory and may need extra fields (acquisition method, internal SKU, exhibition schedule). Treat partners as a v1.5, not v1.
- **What happens when an artist declines a patron's claim?** Best default: the patron's upload stays public but flagged "Disputed by artist". Best alternative: hide from public until resolved. Probably depends on legal advice.
- **Can a patron upload a work that exists on another patron's collection (i.e. one they sold)?** Yes, but the system should detect the duplicate by image/title/artist and offer to link rather than create a parallel record. This is similar to how the existing pending-claim flow handles "I bought this off so-and-so".
- **Does the embed need to be free?** Probably yes for Patronage to grow. But "Patronage Pro" tier with custom theming, removable branding, analytics — defensible later.

---

## Files this would touch (rough)

- New: `src/app/dashboard/collection/upload/` (patron-side upload form)
- New: `src/app/[username]/collection/page.tsx` (public collection page)
- New: `src/app/embed/[username]/collection/route.tsx` + middleware tweak for `X-Frame-Options`
- Extend: `src/lib/artwork-documentation.ts`, `src/lib/artwork-prior-history.ts` (already support what's needed)
- Extend: existing `pending_ownership_claims` flow to handle artist-confirmation of patron uploads
- New migration: `patron_collection_membership` table + `artworks.source` column + trust-tier check constraints
- Reuse: certificate generator, provenance page, claims actions, signed-URL infrastructure for documentation photos

The thing that makes this a tractable build is how little of it is new. Most of it is composition.
