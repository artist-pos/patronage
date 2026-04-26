# Patronage Provenance — How it works

Provenance on Patronage records the life of an artwork: who made it, when it changed hands, and what physical and historical evidence exists for it. It is **not** a guarantee of authenticity — it is a structured record of what the artist has lodged, what has happened on the platform, and what supporting material exists.

This document covers the system from three angles:

1. **Artist** — what they do to register a work, attach evidence, and transfer ownership.
2. **Buyer / current owner** — what they receive and what they can see.
3. **Verifier** — anyone (a future buyer, valuer, gallery, journalist) checking a record's authenticity.

It closes with a frank list of limitations and the credibility upgrades on the roadmap.

---

## What gets recorded

For every artwork registered on Patronage, the system maintains:

- A **ledger ID** in the format `PTRN-YYYY-XXXX-XXXX` (31-character pool, ambiguous characters removed: no `0`, `O`, `1`, `I`, `L`).
- A **chain of custody** — every ownership event, ordered by time, immutable once written. The same artwork can never have two `created` or two `transferred` entries (enforced by a partial unique index in migration 103).
- An **artist-signed certificate** (PDF) issued at transfer time, including the chain of custody, a QR code linking back to the public record, and the artist's signature image.
- Optional **documentation photos** (verso, signature, scale, detail) — private, gated to the creator and current owner.
- Optional **pre-platform history** — exhibitions, prior sales, commissions and other events from before the work was registered. Marked `Self-attested` to distinguish from on-platform entries.
- Per-artist **certificate branding** — logo, signature image, primary/accent colours, font pairing, page orientation. The structure of the certificate is fixed; the artist styles within it.

---

## 1. The artist's journey

### 1.1 Configure once

Studio → Provenance → Settings (`/studio/provenance-settings`):

- Upload a logo (appears top-left of every certificate).
- Upload or draw a signature image (appears bottom-left, stored privately, served to the PDF renderer via short-lived signed URLs).
- Pick a colour palette (primary + accent). Patronage locks the background to off-white for readability.
- Pick a font pair (Classic / Modern / Mixed / Inverse / Editorial / Mono / Condensed / Display) — heading + body fonts that ship with the PDF renderer so certificates look the same on every device.
- Choose page orientation (portrait or landscape).

The live preview updates as the artist adjusts settings. These choices apply to every certificate the artist issues from then on.

### 1.2 List a work

When an artist lists an artwork (or logs an existing sale via Studio → Provenance → "Log a sale"), the system:

1. Inserts the row in `artworks` with the basic fields.
2. Generates a unique `ledger_id` (collision-checked).
3. Writes the initial `created` entry into `artwork_provenance_ledger`, owned by the creator.

At this point the artwork has a permanent provenance URL: `patronage.nz/provenance/{ledger_id}`.

### 1.3 Add depth (optional, lenient)

On `/studio/artworks/[id]` the artist can:

- **Work details** — title, medium, dimensions, year of creation, edition. These show on the certificate and the public provenance page.
- **Documentation photos** — multi-upload per type (verso, signature, scale, detail, other). These are private to the creator and current owner and appear on page 2 of the certificate as small reference tiles.
- **Prior history** — free-text entries (`Exhibited`, `Sold`, `Gifted`, `Commissioned`, `Published`, `Other`) with a date that can be messy ("c. 1985", "Spring 2003"). A best-effort year integer is parsed for sorting; the original text shows on the certificate verbatim.
- **Certificate statement** (`/studio/provenance` row → "Add statement") — a short artist note about the work that appears on page 1 of the certificate, between the work details and the signature.

None of this is mandatory. An artist can register and transfer a work with just a title and an image. The completeness footnote on each row (`Statement added · 2/4 photos · Missing dimensions · Manage details`) is a nudge, not a gate.

### 1.4 Transfer

Two paths:

- **Direct transfer** (Studio → Provenance → "Log a sale" → enter buyer name + email): writes a `transferred` ledger entry, flips ownership, creates a shadow account for the buyer if their email isn't already on Patronage, emails the buyer the certificate PDF.
- **In-message transfer** (DM → "Transfer this work"): the artist initiates from a conversation with a Patronage user; the buyer accepts; same ledger writes, same email.

Idempotency: the unique partial index on `(artwork_id, entry_type)` for `created` and `transferred` means duplicate writes are safely no-op'd. Concurrent reads no longer produce duplicate "transferred to..." rows on the chain.

### 1.5 What "Recorded on Patronage" actually means

The certificate footer reads "Recorded on Patronage" — not "Verified by Patronage". This is deliberate. The platform records and timestamps what the artist lodges; it does not authenticate the artwork or the artist. Authentication is what auction houses, valuers and catalogue raisonné editors do, and that's a meaningfully different bar.

---

## 2. The buyer / current owner's journey

### 2.1 Receive the certificate

On transfer the buyer gets an email with the certificate attached as a PDF. The email links to the public provenance page and offers a "Claim your Patronage collection" CTA if the account was just created for them.

### 2.2 See the work in their collection

If the buyer signs in (or claims a shadow account by email), the work appears in their dashboard. The artist's profile page also shows it under "Collection of {buyer name}" if the buyer has the collection-public flag enabled.

### 2.3 View the certificate

`patronage.nz/provenance/{ledger_id}` is the public page. The buyer (or anyone) can:

- See the artwork image, title, medium, dimensions, year, edition, ledger ID, the artist statement, and the chain of custody.
- Tap "View certificate" to open the PDF in an in-app modal (continuous-scroll, with download and print buttons).
- Scan or screenshot the QR code on the printed certificate to be brought back to the same page.

If the viewer is the artist or the current owner (signed in), they additionally see the **documentation photos** as a thumbnail grid that opens a lightbox. Everyone else sees a "Documentation photos available — sign in to view" notice if any are on file.

### 2.4 Resell (in future)

Resale UI is not yet shipped — the schema supports `resold` entries, but the buyer's "Resell this work" tile says "Coming soon". When that lands, a buyer will be able to transfer the work to the next owner, append a `resold` ledger entry, and issue an updated certificate. Until then, the chain only grows on the artist's side.

---

## 3. The verifier's journey

A verifier is anyone who has a printed certificate (or just a ledger ID) and wants to confirm the record matches what's on the platform. Three entry points:

### 3.1 Scan the QR

Every certificate's QR encodes the full provenance URL. A normal phone camera resolves it directly to `patronage.nz/provenance/{ledger_id}` — no Patronage app needed. The page renders the same chain of custody that's printed on the certificate, so the verifier compares the two and looks for tampering.

### 3.2 Type or scan the ledger ID

`patronage.nz/provenance` (no ID) is the lookup page. Two paths:

- Tap **Scan QR code** — opens the device camera and reads the QR (uses html5-qrcode), then redirects to the matching provenance page.
- Type the ledger ID, or tap the camera icon next to the input, point at the printed `PTRN-YYYY-XXXX-XXXX` text, and let on-device OCR (tesseract.js) read it into the field.

The format check is `PTRN-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}`. Submitting a malformed ID returns a friendly error rather than a 404.

### 3.3 What the verifier learns

Looking at the public page they see:
- The artwork.
- The artist's profile (linked).
- The chain of custody, with each on-platform entry timestamped and the ledger ID matching the certificate.
- Pre-platform entries flagged `Self-attested`.
- The current owner (linked to a public profile if they're not a shadow account).

What the verifier does **not** learn from the page alone:
- Whether the physical object they hold is the same physical object pictured on the page.
- Whether the artist's account on Patronage is genuinely controlled by the artist (vs. an impostor at registration time).
- Whether documentation photos predate the registration or were created as part of it.

The honest framing is: "this record exists on Patronage with this content; the artist lodged it on this date; the chain is internally consistent". Anything stronger requires the upgrades in Section 5.

---

## 4. Data model (one paragraph)

`artworks` carries the work itself (title, medium, dimensions, year, edition, image URL, certificate note, ledger ID, current owner, creator). `artwork_provenance_ledger` is append-only on the unique types — one `created` per artwork, one `transferred` per artwork, any number of `resold`. `artwork_documentation_photos` lives in a private bucket with creator/owner-gated RLS. `artwork_prior_history` is public-read with creator-only writes, sorted by `year_int` then `position`. Branding lives on `profiles` (logo URL, signature URL, theme, primary/accent colours, font pair, orientation). The PDF generator (`@react-pdf/renderer`) and the public page both consume the same `getLedgerByLedgerId()` helper, so the printed and on-screen records cannot drift.

---

## 5. Limitations, and how the system can be made better

In rough priority order. Each is implementable as an additive change without breaking the current system.

### 5.1 No physical-to-digital binding

The single biggest credibility gap. A documentation photo proves "here's what the back of *some* canvas looked like" — it doesn't prove the canvas in front of the verifier is *that* canvas. Fixes (any of these, in increasing strength):

- A unique tamper-evident sticker with a code printed on the certificate. The buyer matches the printed code to the certificate.
- An NFC tag on the work's backing. Tapping it opens the provenance URL.
- A printed-on-the-work microcode (e.g. a small QR or alphanumeric on the verso) that the artist photographs at registration and the certificate shows.

The first option is small enough to ship next.

### 5.2 No cryptographic anchoring

Everything lives in Postgres. You can edit it. A determined skeptic notes this isn't on a public ledger and isn't independently auditable. Fix: hash-anchor each ledger entry into a public timestamp (OpenTimestamps → Bitcoin) or post a daily Merkle root somewhere public (a Git repo, an IPFS pin, a public RSS feed). This answers the "but you control the database" objection without leaning into crypto branding.

### 5.3 Single source of truth — the artist

The artist's account is the only signer. If it's compromised or operated in bad faith, every record from that account is compromised. Fix: a witness/co-signer concept. A gallery, valuer, or institution can co-sign a transfer. The chain entry shows two attesters instead of one, and the certificate reflects this. This is the single biggest credibility move for higher-value work.

### 5.4 Identity isn't verified

"The artist registered this" is contingent on the artist being who they say they are. Fix: a one-time identity check at signup (Stripe Identity or RealMe) gated to artists who want a "Verified identity" mark on their certificates and profile. Optional, opt-in, doesn't block free-tier use.

### 5.5 Certificates are a live view

If the artist edits a certificate note or replaces a documentation photo, future downloads of the same certificate change silently. Fix: snapshot each issued certificate as a versioned `certificates` row with a hash of the rendered PDF at transfer time. The on-screen record stays live; the document the buyer has stays canonical.

### 5.6 No condition reports

In the institutional world, provenance and condition travel together. Fix: a `condition_report` entry type attachable to any transfer, with structured fields (overall condition, specific notes, optional inspector ID).

### 5.7 Resale flow not yet shipped

The schema supports `resold` entries. The UI does not yet let a buyer initiate one. Until that lands, the system records *initial* provenance only. This should be the next major feature in the provenance area, before any of the above.

### 5.8 Bulk import

An artist with a 30-year catalogue can't add prior history one entry at a time. Fix: CSV import for prior-history, optional source-document attachments per entry (scans of catalogues, old invoices), and an OCR-assisted prefill for old paper certificates (the OCR machinery from the verifier flow already exists in the codebase).

---

## Appendix: file map

| Concern | File |
| --- | --- |
| Public provenance page | `src/app/provenance/[ledger_id]/page.tsx` |
| Public verifier landing | `src/app/provenance/page.tsx`, `ProvenanceLookup.tsx` |
| Studio overview | `src/app/studio/provenance/page.tsx`, `ProvenanceList.tsx` |
| Per-artwork editor | `src/app/studio/artworks/[id]/` (page + WorkDetailsEditor + DocumentationPhotosEditor + PriorHistoryEditor) |
| Theme settings | `src/app/studio/provenance-settings/` |
| PDF generator | `src/lib/pdf/transfer-certificate.tsx` |
| PDF viewer | `src/components/provenance/CertificatePdfModal.tsx` |
| Domain helpers | `src/lib/provenance.ts`, `src/lib/provenance-theme.ts`, `src/lib/artwork-documentation.ts`, `src/lib/artwork-prior-history.ts` |
| Schema | `supabase/migrations/098_provenance_ledger.sql`, `099_provenance_backfill.sql`, `100`, `101`, `102_provenance_theme_customisation.sql`, `103_dedupe_provenance_ledger.sql`, `104_documentation_photos_and_prior_history.sql` |

---

## Appendix: language

- **"Recorded on Patronage"** — a record exists on the platform, lodged by the artist on a specific date.
- **"Self-attested"** — the artist supplied this; Patronage neither verified nor witnessed it.
- **"Verified by Patronage"** is **not** used as a status claim anywhere in the product. The lookup page says "Look up a record" / "Provenance lookup", not "Verify".
