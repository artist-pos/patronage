# Social layer — Phases 2 and 3 (roadmap)

This is a direction, not a build list. [social-phase-1.md](social-phase-1.md) is the actionable spec. Nothing here gets built because it's next on the page. It gets built when the gate before it is met.

**Phase 1 creates interaction. Phase 2 creates depth. Phase 3 creates institutional infrastructure.**

---

## The longer aim

Patronage could be where the arts ecosystem keeps its memory: where an artist's career is documented, organisations find and engage artists, commissions are recorded, artworks keep their histories, and the people who help make them are credited. All of that makes the next opportunity easier to create, which is the loop on the About page.

Each layer below makes the one before it more valuable:

| Layer | What's in it | Without the next layer, it's just… |
|---|---|---|
| 1. Discovery | Artists, opportunities, organisations, disciplines, regions | a directory |
| 2. Relationships | Following, saving, appreciating, shortlisting, collecting | social networking |
| 3. Participation | Applications, invitations, commissions, collaborations, responses | activity with no memory |
| 4. Records | Artist histories, provenance, supplier credits, alumni, completed work | hard to maintain |
| 5. Infrastructure | Commission management, collections, organisational reporting | — |

Phase 1 mostly builds layer 2. Phase 2 deepens layers 2–4. Phase 3 starts on layer 5.

---

## Records: who recorded it, and who confirmed it

If Patronage is going to be a trusted record, every record needs to show how far it can be relied on. Some are added by the person they're about. Others are confirmed by a second party. These aren't the same and shouldn't look the same.

Provenance already has the vocabulary (`ArtworkTrustTier`): *recorded by artist*, *recorded by holder*, *confirmed by artist*, *resolved by Patronage*, *disputed*. The provenance page deliberately never says "Verified by Patronage" or "Self-attested". It says who recorded the record and who confirmed it. Use the same pattern for every new kind of record rather than inventing a new one each time:

| Record | Recorded by | Confirmed by |
|---|---|---|
| Exhibition or residency in an artist's history | Artist | The organisation |
| Completed work for a programme | Organisation | The artist |
| Provenance story | Owner | The artist (optional; shown as recorded by the holder until then) |
| Supplier credit | Artist | The supplier, by claiming it |
| Outcome report | Artist | — (aggregate only; the organisation can reply, not confirm) |

Each new record type gets a recorded-by and a confirmed-by from the start, with labels that show it. This doesn't need solving across the whole platform now. It needs applying as each feature is built.

---

## Gates between phases

Don't move on because the next features are ready to build. Move on when people are using what's already there.

| Before starting | The question | How to tell |
|---|---|---|
| Phase 2 | Are people following, saving, appreciating and reporting outcomes? | Saves per active user; organisation follows per artist; outcome prompt response rate |
| Phase 3 | Are those behaviours bringing people back and strengthening relationships? | Return visits from people who save or follow; partners using "Invite to apply"; shortlists that grow over weeks |
| Phase 3 infrastructure | Are organisations running real programmes and recording completed work on Patronage? | Recorded engagements per partner; partners active between rounds |

For email, don't rely on click-through alone. People often read an alert and act without clicking it. Look for applications and saves that follow an alert as well as clicks.

The main risk is building for hypothetical users instead of making the current artists and organisations more successful. If a gate isn't met, fix the phase you're in.

---

## Phase 2 — depth

### Quote with a work
An artist responds to someone's update with their own work: image, audio or video, never text alone. It appears as a **standalone post with the original embedded**, not as a reply in a thread. The responding artist gets their own space, and the original keeps its context. The original artist can turn responses off, as they can with notes. Builds on `project_updates` (a `responds_to_id`) and `admin_hidden`.

### Follow disciplines, regions and projects
"Public sculpture in Waikato" without having to know every artist or organisation involved. This also adds Following and Discover tabs to the feed, in **chronological order, never ranked**. Builds on `DisciplineEnum`, the region taxonomy (182) and projects.

### Organisation notes on artists
The start of a light relationship tool for commissioners: a shortlist of 30 artists that builds up understanding over time ("met at exhibition", "suited to large-scale public work"). **Attach notes to the organisation–artist relationship, not to a board item**, so they survive when a board is reorganised or deleted and follow the artist across shortlists. They are only ever visible to that organisation.

### Provenance stories
One of the most distinctive things on the roadmap. A work doesn't end when it's sold or commissioned: it moves between collections, gets exhibited or installed, and may join a permanent collection. Owners add to that history against the ledger (`artwork_provenance_ledger`), and the artist hears about it. It's about the life of the work: no prices, and private supporters appear as "Private supporter".

### Recording completed work (brought forward from Phase 3)
There are two products inside "organisation records", so they're split here:

- **Recording**, in Phase 2: an organisation links an artist and an artwork to one of its programmes, commissions or exhibitions, and the artist confirms. This reinforces the existing loop from opportunity to outcome, and builds on residency alumni (186), cohorts (206), shortlists and "Invite to apply".
- **Managing**, Phase 3 or later: see below.

You don't need an inventory system to let an organisation record what it commissioned. Gate: partners are using shortlists and invitations.

### Organisation right of reply on outcomes
Needed, but not urgent. Each organisation gets **one public reply per opportunity**. Organisations can add context but can't suppress, edit or remove artists' reports. Comes after outcome reports have run on real rounds.

---

## Phase 3 — institutional infrastructure

### Supplier credits and directory
Much of the work behind an artwork is invisible in its record: framers, printers, foundries, fabricators, installers, art handlers, photographers, conservators. Credit them by role on works and updates. Uncredited suppliers get a claim invite through the existing claim-token flow. A "who framed this?" directory grows out of the credits, so there's no separate directory to launch. This brings a new kind of user to Patronage, which means more support load, so it waits until Phases 1 and 2 are stable. Credits come first; reviews are a separate decision for later.

### Managing completed work
The bigger half of organisation records: collections, installations and locations, and the life of a commissioned work after it's delivered. It's a new operational product, not part of the social layer. It's most relevant to councils, developers, galleries, universities and ongoing public art programmes. It's only worth building once recording (Phase 2) is used and organisations are asking for more.

### Web push (PWA)
Install to the home screen and get push notifications, but only for things someone can act on: deadlines, invitations to apply, organisation alerts. Appreciations and saves stay in the Monday email. Build this when people show they want timely alerts, not because it's technically possible.

### Public and collaborative boards
Boards shown on profiles, and boards shared within an organisation's team. Never for private supporters, and no "most saved" lists. Starts when link-shared boards are actually being shared.

### Curators
Guest-curated boards or features, once awards or a programme give curation a reason to exist.

---

## Not doing

Live studio · weekly prompts · feedback requests · applying together · public like or follower counts · algorithmic ranking · open chat (dropped in 196).

---

## The test for every item

Patronage is a tool for doing things, not a place for appearing to do things. If a feature mostly helps people appear active, it doesn't belong on this roadmap.
