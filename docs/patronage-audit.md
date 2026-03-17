# Patronage — UI/UX & Copy Audit

**March 2026**
Auditor perspective: Senior product designer, ex-Apple/Pinterest/Are.na.
Constraint: Smallest possible fix per issue. No new features. No redesign.
Prioritised: highest impact, lowest effort first.

---

## How to read this

Each item follows this format:
- **Where** — page and element
- **Problem** — what's wrong, from the user's perspective
- **Fix** — the smallest intervention that resolves it
- **Effort** — CSS only / copy only / small component change / logic change

Items are grouped into tiers:
- **Tier 1** — Fix today. CSS or copy changes. Disproportionate impact.
- **Tier 2** — Fix this week. Small component-level changes.
- **Tier 3** — Fix this sprint. Slightly more involved but still surgical.

---

## Part 1: Design Audit

### Tier 1 — Fix today

---

**1.1 · Homepage (authenticated): No value proposition for first-time visitors**

Where: Homepage, above the fold (screenshot 5).

The authenticated homepage opens with "Patronage" as a large centred heading, then "Active Directory" with "Recently joined artists and opportunities closing soon." This reads like a dashboard, not a landing page. But for a newly signed-up artist who just completed onboarding, this is still their first real impression of the platform. There's no moment that says "you're in the right place."

The unauthenticated homepage presumably has a hero with role CTAs and an email digest capture (from the feature inventory), which I can't see in the screenshots. But the authenticated version drops you straight into a directory with no orientation.

Fix: Add a single welcome line above "Active Directory" for users who signed up in the last 7 days: something like "Welcome to Patronage. Here's what's happening." in `text-gray-500 text-base`. After 7 days, suppress it. This costs one conditional render and one line of text. No layout change.

Effort: Small component change.

---

**1.2 · Artists page: Empty profiles dominate the viewport**

Where: Artists directory (screenshot 3).

Three of five visible artist cards have no banner, no avatar — just a grey square with an initial. These empty cards are visually heavier than the populated ones because they're the same size but contain less information. The page looks uninhabited.

Fix: For cards without a banner image, collapse to a compact horizontal layout: a 40px circle with the initial + name + country + discipline tags in a single row, roughly 64px tall. Profiles with banners keep the current tall card. This means populated profiles claim more visual space (correctly — they've invested more in their presence), and empty profiles recede without disappearing.

Implementation: Conditional class on the card wrapper. If `!bannerUrl`, switch from the grid card layout to `flex items-center gap-3 py-3 px-4 border rounded-lg`. The initial circle already exists — just size it down.

Effort: Small component change (one conditional in the card component).

---

**1.3 · Opportunities page: Contradictory counts**

Where: Opportunities page header (screenshot 1).

The page shows "48 listings · Showing 48 results — use filters to narrow down" in the subheading, but the stats bar below says "59 Active Opportunities". Two different numbers in the first 200px of the page.

The discrepancy likely comes from the stats bar counting all active opportunities platform-wide, while the listing count reflects what's currently rendered (possibly paginated or filtered by default). But from a user's perspective, this is a bug.

Fix: Remove the "48 listings · Showing 48 results" subline. The stats bar is the single source of truth. If filters are active, update the stats bar: "Showing 48 of 59 Active Opportunities". One number, one location.

Effort: Copy/logic change (remove one element, update stats bar text conditionally).

---

**1.4 · Opportunity cards: No visual escalation as deadlines approach**

Where: Opportunities grid (screenshot 1).

The "Closing soon" badge appears on 6 of 48 opportunities — the 7-day threshold is reasonable. But all 6 look identical whether there's 1 day or 6 days left. The Adam Portraiture Award at "1 day left" should feel more urgent than Te Oro at "5d remaining".

Fix: Add a visual escalation at ≤1 day: `bg-red-600 text-white` instead of the current dark badge, with text changed to "Closes today" or "Final day". The 2–7 day badges stay as they are. Small change, but it creates a real signal for the most time-sensitive listings.

Effort: Logic change (add conditional class for ≤1 day).

---

**1.5 · Artist profile: Tab bar crowds the bio**

Where: Profile page, tab navigation (screenshot 2).

The tabs (Overview, Work, Studio, CV & Press, Support) sit immediately beneath the bio text with minimal vertical separation. The bio is the most personal text on the page — the artist's own words about their practice. The tab bar is a navigation element. They need breathing room.

Fix: Add `mt-8` to the tab bar container. One line of CSS. The section break becomes legible.

Effort: CSS only.

---

**1.6 · Homepage: "Latest from the Studio." — centred heading with a period**

Where: Homepage, studio feed section (screenshot 5).

"Latest from the Studio." is centred and ends with a full stop. The sections above it ("ARTISTS", "OPPORTUNITIES") are left-aligned, uppercase, small. This heading breaks the page's typographic rhythm and the period is an unusual choice for a section header.

Fix: Left-align. Remove the period. Set to match the section label style used above: `text-xs font-medium tracking-widest uppercase text-gray-500`. Change text to "LATEST FROM THE STUDIO" or simply "STUDIO FEED". The subtitle "Updates from our artists." can stay centred and light if you want contrast, but the heading should anchor left.

Effort: CSS + copy change.

---

**1.7 · Profile: "With Patronage" badge competes with role label**

Where: Artist profile, badge row (screenshot 2).

"With Patronage" and "Artist" sit side by side as same-size pill badges. "With Patronage" is a platform trust signal (like a verification). "Artist" is a role. They serve completely different functions but have identical visual weight.

Fix: Move "With Patronage" to a lighter treatment — `text-xs text-gray-400 tracking-wide` positioned just below or beside the display name, similar to how "@blakeaitken" is displayed. Keep "Artist" as the primary pill badge. The hierarchy becomes: Name → platform affiliation (quiet) → role (badge) → other badges.

Effort: Small component change (move element, change classes).

---

**1.8 · Feed: Inconsistent card heights**

Where: Studio Feed page (screenshot 4).

Three cards visible, all different heights. The "Welcome!" card is tall (text-based content with large lettering), the middle card is medium, the right card is a painting. The grid doesn't use masonry, so the height differences create dead space below shorter cards.

Fix: Two options, pick one:

Option A (quickest): Set `aspect-[4/3]` on the image/content container within each card, with `object-cover` on images. All cards become the same height. Text-based content gets a fixed container with overflow hidden.

Option B (better but more involved): Switch from CSS Grid to CSS `columns-3 gap-4` for a proper masonry layout. This matches the feature inventory's mention of "infinite masonry" — if it's supposed to be masonry already, the implementation may need debugging.

Effort: CSS only (Option A) or small component change (Option B).

---

**1.9 · Opportunities page: Filter row feels disconnected from category tabs**

Where: Opportunities page, between category tabs and filter dropdowns (screenshot 1).

The category tabs (All, Grant, Residency, Commission, Open Call, Prize, Display, Jobs, Studio/Space, Public Art) and the filter dropdowns (All countries, All disciplines, All eligibility, All career stages, Free Entry) are two separate rows with different spacing, alignment, and visual logic. They should read as one filter system.

Fix: Reduce the vertical gap between the tab row and the filter row to `gap-2` or `mt-2`. Ensure both rows share the same left padding. This binds them into a single filter block.

Effort: CSS only.

---

**1.10 · Profile: Portfolio section labelled "PORTFOLIO"**

Where: Artist profile, Overview tab (screenshot 2).

The label "PORTFOLIO" above the work thumbnails is redundant — the images communicate this. On the Overview tab, where this is a preview of the Work tab, a better label signals that this is a curated selection, not the full body of work.

Fix: Change to "SELECTED WORK" or remove the label entirely. If on the Work tab, remove it (the tab is the label). If on Overview, "SELECTED WORK" implies intentional curation, which is more flattering to the artist.

Effort: Copy only.

---

### Tier 2 — Fix this week

---

**2.1 · Artist cards: No hover state**

Where: Artists page, homepage artist list.

Cards have no visible hover feedback. Users can't confirm interactivity until the cursor changes.

Fix: `hover:shadow-sm transition-shadow duration-150` on card wrappers. For the homepage list rows, `hover:bg-gray-50 transition-colors duration-100`.

Effort: CSS only.

---

**2.2 · Opportunity cards: Inconsistent tag counts**

Where: Opportunities grid (screenshot 1).

One card shows 1 discipline tag, another shows 3 + "+8 more", another shows 3 + "+5 more". The varying tag count makes card heights inconsistent and the visual rhythm unpredictable.

Fix: Cap visible discipline tags at 2 per card. After 2, show "+N more". This standardises card height and reduces visual noise. The detail page is where all tags belong.

Effort: Small component change (slice array, compute remainder).

---

**2.3 · Profile: Banner image crops unpredictably**

Where: Artist profile, banner area (screenshot 2).

The banner is a wide panoramic image cropped with `object-cover`. Given the known issue with the edit profile banner focus slider, the displayed crop may not match what the artist intended. But even without the slider bug, wide banners on tall viewports will always lose their top and bottom.

Fix: Add `object-position: center 30%` as the default (most banner images have their subject in the upper-middle third). This is a better default than `center center`. The focus slider fix is separate work — this default improves things even before that's resolved.

Effort: CSS only.

---

**2.4 · Homepage: Opportunity rows lack visual urgency**

Where: Homepage, Opportunities column (screenshot 5).

Opportunities are displayed as flat rows with a thumbnail, title, org, description, tags, and "Closing soon" badge. The time remaining ("1d remaining", "2d remaining") is right-aligned and easy to miss.

Fix: Move the time-remaining text to directly after the title, in `text-red-600 text-sm font-medium` when ≤3 days remain. "The Adam Portraiture Award · 1d left". The urgency becomes part of the primary scan line rather than a footnote.

Effort: Small component change (move element, conditional class).

---

**2.5 · Profile: "STUDIO" section on Overview tab is unclear**

Where: Artist profile, Overview tab, bottom section (screenshot 2).

Below the portfolio preview, there's a "STUDIO" section showing what appear to be studio feed posts. The relationship between this section and the Studio tab isn't obvious. Are these the same posts? A subset? The captions ("Welcome to Patronage. DMs open, or hello@patronage.nz", "for example", "testing") suggest test content, but structurally, the section doesn't explain itself.

Fix: Add a one-line description beneath the "STUDIO" label: "Recent updates" in `text-gray-400 text-sm`. And link the section header to the Studio tab: make "STUDIO" clickable with `→` or "View all" aligned right, matching the homepage pattern.

Effort: Small component change.

---

**2.6 · Opportunities page: Grid/list toggle is subtle**

Where: Opportunities page, top-right of filter area (screenshot 1).

The grid/list toggle icons are present but small and lack active-state differentiation. A user might not notice they can switch views.

Fix: Give the active view icon `text-black` and the inactive one `text-gray-300`. Add `p-1.5 rounded hover:bg-gray-100` to both for a click target that feels intentional.

Effort: CSS only.

---

**2.7 · Profile: External links section ("LINKS") is easy to miss**

Where: Artist profile, right sidebar (screenshot 2).

The links (website, Instagram, Download CV) are right-aligned in a sidebar that sits far from the main content column. On wide screens, the eye has to travel a long distance from the bio to find these links. On narrow screens, they presumably stack below.

Fix: On the desktop layout, add a subtle left border to the links sidebar: `border-l border-gray-100 pl-6`. This creates a visual column that anchors the links as a distinct zone. No layout change — just a 1px line.

Effort: CSS only.

---

**2.8 · Homepage: Artists column shows incomplete info for sparse profiles**

Where: Homepage, Artists column (screenshot 5).

Artist rows show name, country, and sometimes discipline tags. Several rows show no tags at all. For a visitor scanning the homepage, there's no way to tell what kind of artist they are.

Fix: If no discipline tags exist, show the career stage instead (e.g., "Emerging"). If neither exists, show nothing — but track this as a profile completion issue. The display logic should be: disciplines > career stage > empty. This doesn't require new data, just a fallback in the render.

Effort: Small component change.

---

**2.9 · Feed: "New update +" button is full-width and visually heavy**

Where: Studio Feed page (screenshot 4).

The "New update +" button spans the full content width as a bordered rectangle. It's the largest interactive element on the page, but posting an update is not the primary action when visiting the feed — browsing is. The button dominates.

Fix: Shrink to an auto-width button aligned right: `w-auto px-6 py-2 ml-auto` in a flex container. Or move it to a floating action button position (bottom-right, fixed). The feed content should dominate the viewport, not the creation CTA.

Effort: CSS only.

---

**2.10 · Profile: "Follow" and "Message" buttons have equal weight**

Where: Artist profile, top-right (screenshot 2).

"Follow" and "Message" are side-by-side buttons with similar styling. Following is low-commitment (one click, stay on page). Messaging is high-commitment (opens a conversation, requires composing text). They should have different visual weights.

Fix: Make "Follow" the primary button (`bg-black text-white`) and "Message" the secondary (`border border-gray-300 text-gray-700`). Follow is the action you want most users to take. Messaging is for users with specific intent.

Effort: CSS only.

---

### Tier 3 — Fix this sprint

---

**3.1 · Onboarding: Role selection is a gate without context**

Where: /onboarding/role (not visible in screenshots, from feature inventory).

New users hit a role selection page immediately after signup. Without seeing this page, the likely issue is: users don't understand the consequences of their choice. "Artist" vs what? If the roles have different feature sets (and they do — the profile structure differs significantly), the user needs a one-line explanation of each before choosing.

Fix: Under each role option, add a single sentence in `text-gray-500 text-sm`:
- Artist: "Build your profile, find opportunities, share your practice."
- Non-artist: "Follow artists, collect work, discover new practices."

No additional UI. Just context beneath each option.

Effort: Copy only.

---

**3.2 · Messaging: Role-specific welcome DM on signup**

Where: Messaging inbox (not visible in screenshots, from feature inventory).

Instead of an empty inbox with placeholder text, send every new user a welcome DM from the @patronagenz account on signup. This means the inbox is never empty, the user gets practical orientation without a separate onboarding tour or FAQ page, and the conversation thread doubles as a support channel. Different roles get different messages tailored to what they can actually do.

Fix: Trigger a DM from the existing @patronagenz account on account creation (Supabase function or onboarding completion handler). Send as a regular message — no special message type needed. Branch on role selection:

**Artist welcome:**

"Welcome to Patronage. A few things worth doing first:

— Add a few works to your portfolio
— Check the opportunities board for open deadlines
— Post a studio update if you have something in progress

When you sell or gift a work, you can mark it as collected and credit the new owner — they'll get a provenance link to verify ownership.

If you have questions or feedback, reply here — this is a real inbox."

**Patron welcome:**

"Welcome to Patronage. Here's how to get started:

— Browse the Artists directory to find and follow artists
— When an artist adds a work to your collection, you'll be able to confirm and view it from your dashboard
— Check the Opportunities board if you're looking for roles in the arts

If you have questions, reply here — this is a real inbox."

**Partner welcome:**

"Welcome to Patronage. Here's how to get started:

— Submit an opportunity listing from your dashboard — grants, residencies, open calls, and jobs are all welcome
— Once listed, you can manage applications and track engagement from your partner dashboard
— Listings are free and reach artists across Aotearoa and Australia

If you have questions, reply here — this is a real inbox."

Important: The @patronagenz profile needs to look intentional — Patronage logo as avatar, a proper bio, Partner role so it doesn't appear in the Artists directory. This is the first profile a new user will ever visit.

Effort: Logic change (trigger message on signup with role-based branching, prepare the @patronagenz profile).

---

**3.3 · Dashboard: Analytics without context**

Where: Dashboard analytics (not visible in screenshots, from feature inventory).

The dashboard shows profile views (30-day + comparison), CV downloads, website clicks, artwork views, followers gained. Raw numbers without context are anxiety-inducing for artists. "12 profile views" — is that good? Bad? Normal?

Fix: Add a single contextual line beneath the primary metric: "Profile views this month" with the number, and below it in `text-gray-400 text-xs`: "↑ 3 more than last month" or "About the same as last month" or "New profiles typically see growth in the first 8 weeks." This doesn't require benchmarking against other users — just comparison to self and gentle normalisation.

Effort: Logic change (comparison calculation likely already exists per feature inventory "30-day + comparison").

---

**3.4 · Opportunity detail: Save button discoverability**

Where: Opportunity detail page (from feature inventory).

The save button uses optimistic UI and prompts login if unauthenticated. But from the grid view, there's no way to save without opening the detail page first. Artists browsing the grid may want to bookmark several quickly.

Fix: Add a small bookmark icon to the top-right corner of each opportunity card in the grid view, visible on hover: `opacity-0 group-hover:opacity-100 transition-opacity`. Click saves without navigating away. This matches the existing save functionality — it just surfaces it earlier in the flow.

Effort: Small component change.

---

**3.5 · Application pipeline: Status labels need more context**

Where: Applications tab (from feature inventory).

The pipeline shows statuses: Received → Under Review → Shortlisted → Upload Required → Approved → Not Selected. These are clear labels, but the transitions between them are opaque. When does "Received" become "Under Review"? Is "Not Selected" final?

Fix: Add a one-line description beneath each status badge, visible on the application card:
- Received: "Your application has been submitted."
- Under Review: "The organiser is reviewing applications."
- Shortlisted: "You've been shortlisted."
- Upload Required: "Please upload the requested files."
- Approved: "Congratulations — you've been selected."
- Not Selected: "Not selected this time."

These are static strings, not dynamic. Just a `text-gray-400 text-xs` line beneath the badge.

Effort: Copy + small component change.

---

**3.6 · Mobile: Card sizing on landing page and opportunities**

Where: All pages on mobile (noted as a known issue — oversized cards).

The card components likely use fixed or semi-fixed widths that don't scale properly on small viewports. On mobile, opportunity cards and artist cards should be full-width single-column.

Fix: Ensure the grid switches to `grid-cols-1` at mobile breakpoints (`sm:grid-cols-2 lg:grid-cols-3`). Each card should be `w-full`. If cards have `max-w-*` constraints, remove them at mobile. This is likely a Tailwind responsive prefix issue — check that the grid parent has `grid-cols-1` as the base (unprefixed) value.

Effort: CSS only.

---

**3.7 · Mobile: Hamburger menu dropdown alignment**

Where: Mobile nav, hamburger dropdown.

The dropdown content is currently left-aligned. Since the hamburger icon sits on the right side of the nav bar, the dropdown should right-align to it — the menu should open from where the user tapped.

Fix: Add `right-0` (or `origin-top-right` if using a transform-based menu) to the dropdown container. One class.

Effort: CSS only.

---

**3.8 · Profile edit: Banner image focus slider**

Where: /profile/edit (known regression — slider should pan vertically, not zoom).

This is a noted bug. The design guidance is: the slider should control `object-position` on the Y axis (0% = top of image, 100% = bottom), not `transform: scale()`. The preview should show the exact crop that will appear on the public profile.

Fix: Map the slider value to `object-position: center ${value}%` on the banner `<img>`. Store the value in the profile record. Apply it on the public profile page. Remove any scale/zoom logic.

Effort: Logic change.

---

**3.9 · Provenance claim page: Copy should explain what's happening**

Where: /claim/[token] — the page a collector lands on when an artist marks a work as collected and enters an email for someone not yet on the platform.

The collector receives an email with a claim link. They land on a page showing the artwork preview and signup/login CTAs. This is a high-trust moment — someone they know (the artist) has credited them as owning a work. The page copy needs to make that context immediately clear, not just show a generic signup form with an artwork thumbnail.

Fix: Lead the page with: "[Artist name] has added [artwork title] to your collection on Patronage. Sign up to confirm ownership and view it in your collection." Then the signup/login CTAs. The artwork preview does the visual work; the copy does the trust work.

Effort: Copy only (the data is already available — artist name and artwork title are in the provenance_links row).

---

## Part 2: Copy Audit

Voice benchmark: Direct, clear, warm but not precious. Written for artists in Aotearoa and Australia specifically. Understands financial precarity, admin burden, lack of infrastructure. Does not oversell.

---

### Homepage (Unauthenticated Landing Page)

**Current hero headline:** "Patronage"

The name is already in the nav. The hero headline is where you make your case — using it for the brand name wastes the most prominent line on the page.

**Current subheading:** "Grants, residencies, and open calls for New Zealand and Australian creatives — visual artists, musicians, writers, poets, dancers, and filmmakers."

A comma-separated inventory. By the time you reach "filmmakers" you've forgotten the start. And "creatives" reads like a government funding application.

**Current second line:** "A free professional profile and weekly-updated opportunities directory — all in one place. A community for artists, patrons, and partners."

Two dashes, two thoughts, three audience segments. Speaks to everyone simultaneously, lands with no one.

→ Rewrite hero headline: **"Find funding. Build your profile. Get seen."**

→ Rewrite subheading: **"Grants, residencies, and open calls for artists across Aotearoa and Australia — updated weekly, free to use."**

→ CTA: "Browse Opportunities" — keep as-is.

→ Role cards — tighten the descriptions:
- Join as an Artist → **"Build your profile and find opportunities."**
- Join as a Patron → **"Follow and collect work from artists you believe in."**
- Join as a Partner → **"List opportunities and reach artists directly."**

**Current bottom CTA:** "NEVER MISS A DEADLINE" / "Sign up to get opportunities straight to your inbox."

"NEVER MISS A DEADLINE" is good energy but reads like a newsletter popup.

→ Rewrite heading: **"STAY ACROSS IT"**
→ Rewrite subtext: **"New opportunities in your inbox every week. Free."**
→ Button: "Create a free account" — keep as-is.

---

### Homepage (Authenticated)

**Current (page title):** "Patronage · Professional Infrastructure for Artists"

This is strong. "Professional Infrastructure" is the right framing — it's not a marketplace, not a gallery, not a social network. Keep this.

**Current (authenticated heading):** "Active Directory"

"Active Directory" sounds like a Microsoft product. It's technically descriptive but tonally dead.

→ Rewrite: **"What's happening"** or **"Right now"** — something that communicates liveness without jargon. If you want to keep it functional: **"Artists & Opportunities"**.

**Current (authenticated subheading):** "Recently joined artists and opportunities closing soon."

This is fine but reads like a UI label, not a sentence a person would say.

→ Rewrite: **"New artists and opportunities closing soon."** (Cut "Recently joined" to "New" — tighter, same meaning.)

**Current:** "Latest from the Studio."

The period at the end of a section heading reads as a stylistic choice, but it's inconsistent with every other heading on the page. If it's intentional (a brand punctuation choice), it should appear everywhere. If not, remove it.

→ Rewrite: **"From the studio"** — shorter, warmer, implies you're looking into someone's workspace.

**Current (subheading):** "Updates from our artists."

"Our artists" implies ownership. Patronage doesn't own these artists.

→ Rewrite: **"Updates from the community."** or simply remove the subheading. The section title is sufficient.

---

### Opportunities Page

**Current heading:** "Art Grants & Opportunities"

Good. Direct. No notes.

**Current subheading:** "48 listings · Showing 48 results — use filters to narrow down."

This reads like a database query result. "Use filters to narrow down" is instruction, not invitation.

→ Rewrite (if keeping a subheading at all): **"59 active opportunities. Filter by type, discipline, or location."** — statement of abundance, then a practical pointer.

**Current "Found an opportunity?" button:** "Found an opportunity? +"

Good concept — crowdsourcing is the right instinct. The "+" symbol is slightly ambiguous.

→ Rewrite: **"Submit an opportunity"** — removes ambiguity. Or if you want conversational tone: **"Know of one we're missing?"** with "Submit" as the button text.

---

### Artist Profile

**Current bio (your profile, as example):** "I'm an artist working across public interventions and cultural infrastructure. I'm currently building Patronage to help artists find funding, share their work, and connect with the people who support it."

This is excellent. It's exactly the voice the platform should have everywhere. Direct, specific, no filler.

**Current tab labels:** Overview, Work, Studio, CV & Press, Support

These are clean. "CV & Press" is a smart combination. "Support" is slightly ambiguous — does this mean supporting the artist financially, or getting support/help? From context it's the former, but a new visitor might hesitate.

→ Rewrite option: **"Support this artist"** as the tab label if space allows. Or ensure the tab content opens with a line that clarifies: "Support [name]'s practice" or similar.

**Current section labels:** "SELECTED PRESS", "PORTFOLIO", "STUDIO"

"SELECTED PRESS" is good — "selected" implies curation.

→ Rewrites:
- PORTFOLIO → **"SELECTED WORK"** (matches "SELECTED PRESS" pattern)
- STUDIO → **"STUDIO UPDATES"** (clarifies these are posts, not a physical studio description)

---

### Empty States

Every empty state is a moment where the platform either earns or loses trust.

**Empty portfolio (artist's own view):**
→ **"No work added yet. Your portfolio is how people discover your practice — even one or two pieces makes a difference."**

**Empty portfolio (visitor view):**
→ **"[Name] hasn't added work yet."** — No apology, no "check back later". Just a fact.

**Empty studio feed:**
→ **"Nothing here yet. Studio updates are for works in progress, process shots, thoughts — whatever you're working on right now."**

**Empty CV & Press:**
→ **"No exhibitions or press added yet."** For the artist's own view, add: **"You can add these in your profile settings."** with a link.

**Empty saved opportunities (dashboard):**
→ **"No saved opportunities. When you find something worth coming back to, save it and it'll appear here."**

**Empty applications (dashboard):**
→ **"No applications yet. When you apply through Patronage, you can track their status here."**

**Empty inbox:**
→ No longer applicable — the welcome DM from @patronagenz (see 3.2) ensures the inbox is never empty on first visit. If the user deletes all conversations, fall back to: **"No messages yet."**

**No search results (artists directory):**
→ **"No artists match those filters."** — Don't suggest broadening the search. Just state the result.

**No search results (opportunities):**
→ **"No opportunities match those filters. New listings are added regularly."** — The second sentence is a gentle reason to come back.

---

### Onboarding

**Role selection page (/onboarding/role):**

→ Heading: **"How will you use Patronage?"**
→ Artist option: **"I'm an artist"** with subtext: **"Build your profile, find opportunities, share your practice."**
→ Non-artist option: **"I support artists"** with subtext: **"Follow artists, collect work, discover new practices."**

---

### Error Messages & Form Labels

**General form validation:**
→ Avoid: "This field is required."
→ Use: "Please add your [field name]." or simply highlight the field with a red border.

**Image upload errors:**
→ Avoid: "File too large. Maximum size is 5MB."
→ Use: "This image is too large — try one under 5MB."

**Login errors:**
→ Avoid: "Invalid credentials."
→ Use: "That email and password combination didn't work. Try again or reset your password."

**Application submission confirmation:**
→ Avoid: "Your application has been submitted successfully."
→ Use: "Application submitted. You'll get an email confirmation, and you can track the status in your dashboard."

**Save confirmation (opportunity):**
→ Avoid: "Opportunity saved."
→ Use: "Saved." (One word is enough. The optimistic UI already shows the state change.)

---

### Partners Page

The partners page speaks to organisations — galleries, institutions, grant bodies, residency programmes. The copy should address them as peers, not as customers.

→ Heading: **"List your opportunity"** or **"Reach artists directly."**
→ Subtext: **"Patronage connects your grants, residencies, and open calls with artists across Aotearoa and Australia. Free to list."**

The word "free" matters here. Organisations expect to pay for listings. Leading with it removes the first objection.

---

### Weekly Digest Email

**Subject line:** **"This week on Patronage"** — simple, scan-friendly in an inbox.

**Opening line:** Avoid "Here are this week's opportunities." Use: **"A few things worth your time this week."**

**Closing line:** Avoid "Visit Patronage to see more." Use: **"See all opportunities →"** as a button. No sentence needed.

---

### Global Copy Patterns

**Dates:** Use relative time for recent items ("2 days left", "Posted yesterday") and absolute dates for anything older than 2 weeks ("15 March 2026"). Never show both simultaneously on the same element.

**Currency:** Always show the currency code. "$5,790" is ambiguous — NZD? AUD? USD? The screenshots show some cards with "USD" and some without. Standardise: always show the code after the amount.

**Country labels:** "NZ" and "Global" as tags are fine. On the detail page, expand "Global" to "Open to all countries" for clarity.

**"Free Entry" filter:** Good label. Consider also showing a "Free to enter" tag on the card itself when applicable — artists scanning for affordable opportunities shouldn't have to click into each one to check.

---

## Summary: Top 10 Highest-Impact Changes

1. **Rewrite the landing page hero** — "Find funding. Build your profile. Get seen." instead of repeating the brand name (copy)
2. **Reconcile opportunity counts** — one number, one location (1.3)
3. **Collapse empty artist cards** — compact layout when no banner image (1.2)
4. **Send a welcome DM on signup** — from @patronagenz, practical orientation, doubles as support channel (3.2)
5. **Add breathing room above profile tabs** — `mt-8` (1.5)
6. **Rewrite "Active Directory" heading** — lose the Microsoft energy (copy)
7. **Fix "Latest from the Studio." alignment and punctuation** — left-align, drop the period (1.6)
8. **Standardise opportunity card tag counts** — cap at 2 + overflow (2.2)
9. **Add hover states to all cards** — `hover:shadow-sm` (2.1)
10. **Write every empty state** — each one needs one warm, clear sentence (copy)

These ten changes, done well, would make Patronage feel noticeably more polished without altering the design language or adding a single feature.
