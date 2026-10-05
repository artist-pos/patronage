# Patronage UX & Accessibility Overhaul

**Goal:** Make Patronage legible and navigable for less technical users (including older adults) without restructuring the entire app. Simplify each space before merging them.

**Principle:** Three separate workspaces are fine. The problem is each one has too much in it, uses insider language, and doesn't confirm that things worked.

---

## Phase 1 — Language + Routes (low effort, high signal)

**Do these together in one pass so URLs reflect final language from day one.**

### 1a. Renames

All user-facing copy, nav labels, page titles, button text, and empty states.

| Current | Replace with |
|---|---|
| Pipeline / activate pipeline | Open call / Publish |
| Opportunities (partner side) | Calls |
| Provenance certificate | Certificate of authenticity |
| Holder attribution claims | "Someone says they own your work" |
| Support tiers | Ways to support me |
| Campaigns | QR codes |
| Viewing Rooms | Online exhibitions |
| Roster | Your artists |
| Collectives | Groups you're part of |
| Transfer | Sell or give to someone |
| Digest | Weekly email |
| Terminate account | Close account |
| Pipeline entry fee | Publishing fee |
| Acquisition mode | How this work was acquired |

Files to touch: nav labels in `src/components/layout/`, page headings across `src/app/studio/`, `src/app/partner/`, `src/app/dashboard/`, copy in `src/lib/email.ts`.

### 1b. Real routes instead of `?section=` params

Replace query-param navigation with real routes so the browser back button works correctly. Users who rely on back (older users especially) will otherwise assume they broke something.

| Current | New route |
|---|---|
| `/studio?section=works` | `/studio/works` |
| `/studio?section=feed` | `/studio/feed` |
| `/studio?section=opportunities` | `/studio/opportunities` |
| `/studio?section=campaigns` | `/studio/qr-codes` |
| `/studio?section=profile-cv` | `/studio/profile` |
| `/studio?section=support-tiers` | `/studio/support` |
| `/studio?section=analytics` | `/studio/analytics` |
| `/studio?section=account` | `/studio/account` |
| `/studio?section=home` | `/studio` (default) |

Add permanent redirects from old URLs so bookmarks and any emailed links don't break.

**Effort:** ~3–4 days. Routing changes, redirect config, updating all internal links.

---

## Phase 2 — Merge Duplicates

Eliminate pages that overlap. Users who find the same information in two places assume one of them is wrong.

### 2a. Works + Artworks → single page
`/studio/works/[id]` (basic edit) and `/studio/artworks/[id]` (deep edit) are the same object. Merge into one page. Show advanced fields (acquisition mode, documentation photos, prior history, provenance) collapsed under "Add more detail." Expand on tap. Remove the deep-edit route.

### 2b. Analytics → one view on Home
Remove `/studio/analytics` and `/profile/analytics` as separate pages. Show a summary card on the studio home dashboard with a "See full stats" expand. Delete the separate analytics routes.

### 2c. Profile & CV → studio only
`/studio?section=profile-cv` and the "CV & Press" + "Collectives" settings tabs are the same data. Remove those tabs from `/settings`. Settings becomes: Profile (name, avatar, location, contact) and Account (email, password, notifications, close account). CV, press, collectives and exhibitions live only in `/studio/profile`.

### 2d. Patron purchases → Collection
`/dashboard/works` (Stripe purchases) merges into `/dashboard/collection`, with purchased works tagged "Bought on Patronage." Remove the separate works page.

### 2e. Notes → Messages
Remove `/profile/notes` as a standalone page. Surface notes as a message type inside `/messages` so there's one inbox.

**Effort:** ~1 week across all five merges.

---

## Phase 3 — Contrast, Type, Touch Targets

One-line fixes that improve every screen for older users.

### 3a. Darken `muted-foreground`
Current `#888` on `#FAFAF9` is ~3.4:1 — fails WCAG AA for body text (requires 4.5:1).  
Change in `src/app/globals.css`:
```css
--muted-foreground: oklch(0.44 0 0); /* ~#666, ~5.5:1 on #FAFAF9 */
```
This propagates to every hint, helper text, placeholder, secondary label, and caption across the app.

### 3b. Minimum font sizes
Audit for anything below 14px. Nothing that communicates meaning should be below 14px; body and form labels should be 16px minimum.

### 3c. Touch targets
Minimum 44×44px tap area on all interactive elements. Minimum 8px gap between adjacent tappable elements (pill tags especially). Most critical: mobile nav items, action buttons on cards, the pill/tag filter rows on opportunities.

**Effort:** ~1–2 days.

---

## Phase 4 — Feedback and Destructive Actions

Older users are disproportionately anxious about "did it save?" and "did I just delete something I can't recover?"

### 4a. Persistent save confirmation
Replace or supplement disappearing toasts (3s is too fast for slow readers) with:
- An inline "Saved ✓" state next to the submit button that persists until the next edit
- Toasts held for at least 5 seconds where used
- Toast should include what was saved ("Profile updated")

### 4b. Destructive action pattern
- **Delete a work:** show undo window (30 seconds) rather than a confirm dialog. Non-threatening, and no data lost on accidental tap.
- **Close account:** two-step sequence on separate screens, not a single confirm dialog. Screen 1 explains what's lost. Screen 2 requires typing "CLOSE" or similar.
- **Remove from collection, end support subscription:** confirm in plain words ("You'll stop supporting [name]. They won't be notified.") before acting.

**Effort:** ~2–3 days.

---

## Phase 5 — View As (Owner Tool)

Add a "View as artist / patron / partner" toggle for the owner role. Renders the app exactly as that role would see it — same nav, same guards, same empty states.

This protects testing (you can see what real users see) and safety (admin-only UI can't accidentally leak to users without you noticing).

Implementation: a cookie or session flag read in the root layout that overrides the role check. Toggle only accessible when `profile.role === "owner"`. Shown as a small bar at the top of the screen in owner mode.

**Effort:** ~2 days.

---

## Phase 6 — Consistent Patterns Across Three Spaces

Keep artist / patron / partner as separate workspaces, but make them feel like the same product. This halves the cognitive load of switching between roles and makes a later merge mostly routing rather than retraining.

- **Same nav position:** primary nav always left sidebar on desktop, bottom bar on mobile. Currently studio has a sidebar, dashboard uses tabs.
- **Profile-includes-settings everywhere:** one place for account settings regardless of role.
- **Shared language for shared things:** "Opportunities," "Messages," "Profile" mean the same thing in all three spaces.
- **Consistent empty states:** same component, same pattern, same voice.

**Effort:** ~3–4 days for layout consistency; ongoing for copy.

---

## Phase 7 — Photo-First Work Upload

The current upload flow starts with form fields. Artists photographing work on their phone need image first.

New flow:
1. Tap "Upload a work" → camera/file picker opens immediately
2. After image selected: title field (required), price toggle ("Is it for sale?")
3. "Add more detail" expander for everything else (description, dimensions, medium, series)
4. Publish

The detailed fields still exist — they're just not blocking. Artists can fill them later from the work edit page.

**Effort:** ~2 days to restructure the upload form.

---

## Phase 8 — Partner: Templates + Payment at Publish + Invite to Apply

Three changes to the partner flow, done together since they touch the same wizard:

### 8a. Opportunity templates
Replace blank-slate form builder with templates as the starting point:
- Mural commission
- Public art commission  
- Residency
- Exhibition call / open call
- Job / employment

Each template includes a pre-built application form with sensible questions and sane defaults. "Customise the form" is an optional step, not the required one.

### 8b. Payment at Publish
Move the pipeline activation fee from a separate `/partner/opportunities/[id]/activate` page into the final step of the wizard ("Publish"). Partners shouldn't have to find a separate page after finishing the form. Show the fee plainly in the wizard summary screen.

### 8c. Invite to apply (all partners)
Currently only roster-eligible orgs (galleries, residencies) can find and contact specific artists. Every partner needs this.

Add an "Invite artists to apply" action:
- Available from Home and from each call's detail page
- Search Patronage artists by name, region, or medium
- Paste email addresses for artists not yet on the platform
- Invited artists receive a link to the opportunity that works as a sign-up flow if needed

This is distinct from "Add to your artists" (roster), which stays restricted.

**Effort:** ~1 week total.

---

## Phase 9 — Teaching Empty States + Home Checklist

### 9a. Empty states
Every empty section needs: what this section is for, why it's empty, and the first action as a button. "No works yet" becomes "Your portfolio lives here. Add your first work to get started. → Upload a work."

### 9b. Home checklist (new users)
For users who haven't completed their profile, Home shows a short setup checklist:
- Add a profile photo
- Write two sentences about yourself  
- Add your first work *(artists)*
- Set up payment *(artists, optional)*

Once all items are done, the checklist disappears and Home becomes the alerts + stats view.

**Effort:** ~2–3 days.

---

## Phase 10 — Privacy Simplification

Replace patron's seven privacy toggles (`show_taste`, `show_follows`, `show_location`, `show_previously_collected`, `show_supporting`, `private_supporter`, `collection_public`) with:

- One toggle: **Public profile / Private profile**
- "Choose what's shown" link for users who want granular control (expands the individual toggles)
- `private_supporter` surfaces as a checkbox *at the moment someone supports an artist* ("Keep my support private"), not buried in settings where its meaning is unclear

**Effort:** ~1 day for the settings UI; existing DB fields unchanged.

---

## Phase 11 — Messaging Rule Fix

Artists can currently only initiate conversations with users who follow them. This is invisible until it blocks someone — a less confident user reads a missing button as a broken site.

Options (pick one):
- **Expand initiation rights** to include: users the artist has applied to an opportunity for, or any partner whose opportunity the artist has saved. One query change in `getOrCreateConversation`.
- **Explain the missing button:** "Message [Name] once they follow you — share your profile link to connect." Small but prevents confusion.

Recommendation: expand rights for partner→opportunity interactions, add explanation for the general case.

**Effort:** ~half a day.

---

## Phase 12 — Unified Workspace (later, if at all)

Merge artist / patron / partner into one adaptive workspace where sections appear based on capabilities. Navigation becomes:

| Capability | Nav item |
|---|---|
| Has works / uploads | My Work |
| Has collection | Collection |
| Has opportunities saved/applied | Opportunities |
| Has active support or tiers | Supporting / Supporters |
| Has calls / pipeline | Calls |
| Has roster | Your artists |
| All | Home · Messages · Profile |

**This is Phase 12 for a reason.** Most of the value comes from phases 1–6. Structural unification risks breaking the mental models of existing users who know "my place is studio" or "my place is dashboard." Revisit once phases 1–6 are done and user feedback is clear.

---

## Summary table

| Phase | What | Effort | Impact |
|---|---|---|---|
| 1 | Renames + real routes + redirects | 3–4 days | High |
| 2 | Merge duplicates | ~1 week | High |
| 3 | Contrast, font sizes, touch targets | 1–2 days | High for older users |
| 4 | Persistent saved + destructive action patterns | 2–3 days | High for older users |
| 5 | View as artist/patron/partner (owner tool) | 2 days | Medium |
| 6 | Consistent patterns across three spaces | 3–4 days | Medium |
| 7 | Photo-first work upload | 2 days | Medium |
| 8 | Partner templates + pay at publish + invite to apply | ~1 week | High for partners |
| 9 | Teaching empty states + home checklist | 2–3 days | High for new users |
| 10 | Privacy simplification | 1 day | Medium |
| 11 | Messaging rule fix | 0.5 days | Low effort |
| 12 | Unified workspace | Weeks | Long-term |
