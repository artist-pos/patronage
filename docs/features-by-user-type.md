# Patronage — Features by User Type

Comprehensive audit of every feature and piece of functionality in the platform, grouped by user role and organised by page/route.

**Status key:**
- ✅ Fully working — real data, real actions, end-to-end functional
- ⚠️ Partially working — some parts stubbed, incomplete, or missing edge-case handling
- 🚧 Stubbed/placeholder — UI shell exists but no real functionality yet

---

## Table of Contents

1. [Visitor (not logged in)](#visitor-not-logged-in)
2. [Artist](#artist)
3. [Patron](#patron)
4. [Partner](#partner)
5. [Admin / Owner](#admin--owner)
6. [API Routes](#api-routes)
7. [Cross-Role Feature Matrix](#cross-role-feature-matrix)
8. [Features in Code with No UI Entry Point](#features-in-code-with-no-ui-entry-point)
9. [Stubbed / Roadmap Items](#stubbed--roadmap-items)

---

## Visitor (not logged in)

### `/` — Home page
| Feature | What it does | Status |
|---------|-------------|--------|
| Hero section | Role-specific CTAs (artist signup, patron signup, partner info) | ✅ |
| Featured artists carousel | Shows artist cards with portfolio thumbnails | ✅ |
| Closing-soon opportunities | Top 6 opportunities closing within 14 days | ✅ |
| Studio feed highlights | Latest project updates from all artists | ✅ |
| Live platform stats | Opportunity count + total funding available | ✅ |

### `/opportunities` — Opportunity browser
| Feature | What it does | Status |
|---------|-------------|--------|
| Browse all opportunities | Masonry and list view of published, active opportunities | ✅ |
| Filter by type | Grant / Residency / Commission / Open Call / Prize / Display / Job / Studio & Space / Public Art | ✅ |
| Filter by country | NZ / AUS / UK / US / EU / Global | ✅ |
| Filter by discipline | Sub-category tags (Photography, Painting, etc.) | ✅ |
| Filter by career stage | Emerging / Mid-Career / Established | ✅ |
| Filter by eligibility | Māori / Pasifika / Indigenous / Youth / International | ✅ |
| Free-entry filter | Shows only opportunities with no entry fee | ✅ |
| Search | Full-text search across title, organiser, city, caption, description | ✅ |
| View opportunity detail | Deadline, funding amount, organiser, description, external link | ✅ |
| External link click-through | Opens opportunity on organiser's website; tracked as engagement event | ✅ |
| View count tracking | `POST /api/opportunities/[id]/view` — increments view_count on page load | ✅ |

### `/opportunities/[id]` — Opportunity detail page
| Feature | What it does | Status |
|---------|-------------|--------|
| Full opportunity details | Description, deadline, eligibility, funding, tags, organiser logo | ✅ |
| External apply button | Links to organiser's website (routing_type=external) | ✅ |
| Pipeline apply button | Opens ApplyModal for pipeline opportunities (requires login) | ✅ |
| Save button | Bookmarks opportunity (requires login) | ✅ |
| Related opportunities | Shows similar opportunities by type/country | ✅ |

### `/artists` — Artists directory
| Feature | What it does | Status |
|---------|-------------|--------|
| Browse all artists | Gallery and list view of public artist profiles | ✅ |
| Filter by country | NZ / AUS / International | ✅ |
| Filter by career stage | Emerging / Mid-Career / Established | ✅ |
| Filter by medium | Painting, Photography, Sculpture, etc. | ✅ |
| Artist cards | Shows avatar, name, disciplines, work count, badges | ✅ |

### `/[username]` — Public artist profile
| Feature | What it does | Status |
|---------|-------------|--------|
| Overview tab | Bio, disciplines, career stage, badges, stats | ✅ |
| Work tab | Portfolio grid with click-to-expand detail modal | ✅ |
| Studio tab | Latest studio updates (image/audio/video/text/embed) | ✅ |
| CV & Press tab | CV download link, exhibition history, bibliography | ✅ |
| Support tab | Artist support section (shown only if `support_enabled=true`) | ⚠️ Gated on flag; support payment flow not yet implemented |
| Available works section | Artworks listed for sale with price | ✅ |
| Patron collection section | Works collected by users who follow this artist | ✅ |
| Matched opportunities | Live opportunities relevant to this artist's disciplines/country | ✅ |
| Profile view tracking | Fires analytics event on load | ✅ |
| Follow button | Requires login | ✅ |
| Message button | Requires login | ✅ |
| Enquire button | Opens enquiry conversation (requires login) | ✅ |

### `/feed` — Studio feed
| Feature | What it does | Status |
|---------|-------------|--------|
| Browse all studio updates | Masonry feed of updates from all artists (image/audio/video/text/embed) | ✅ |
| Infinite scroll | `GET /api/feed` with cursor-based pagination | ✅ |
| Content-type rendering | Images at natural aspect ratio; audio player; video player; text prose; iframes for embeds | ✅ |

### `/auth/login` — Sign in
| Feature | What it does | Status |
|---------|-------------|--------|
| Email/password login | Supabase Auth; redirects to `?next=` param if present | ✅ |

### `/auth/signup` — Sign up
| Feature | What it does | Status |
|---------|-------------|--------|
| Role-based signup | Artist / Patron / Partner; pre-fills role on form | ✅ |
| Email verification | Supabase sends confirmation email | ✅ |

### `/partners` — Partner info & submission
| Feature | What it does | Status |
|---------|-------------|--------|
| Partner value prop | Marketing page explaining listing options, pricing | ✅ |
| Opportunity submission form | Submit external or pipeline opportunity | ✅ |

### Static pages
| Page | Status |
|------|--------|
| `/privacy` — Privacy policy | ✅ |
| `/terms` — Terms of service | ✅ |
| `/unsubscribe` — Email unsubscribe | ✅ |

### Global search — `GET /api/search`
| Feature | What it does | Status |
|---------|-------------|--------|
| Opportunity search | Searches title, organiser, description | ✅ |
| Artist search | Searches name, username, bio | ✅ |
| No auth required | Public endpoint | ✅ |

---

## Artist

*Role: `artist` or `owner` (owner = artist + admin combined)*

### `/dashboard` — Artist career dashboard
| Feature | What it does | Status |
|---------|-------------|--------|
| Closing Soon tab | Pipeline opportunities closing within 14 days; relevant to artist's disciplines | ✅ |
| Saved tab | Bookmarked opportunities with status (saved/applied) | ✅ |
| Applied tab | Opportunities the artist has submitted applications to | ✅ |
| Applications tab | Real-time tracker — shows each pipeline application with status badge (pending → shortlisted → selected → approved_pending_assets → production_ready → rejected) | ✅ |
| Upload high-res asset | When status=`approved_pending_assets`, artist uploads final file to private `production-assets` bucket | ✅ |
| Expired tab | Past-deadline saved opportunities | ✅ |
| Analytics tab | 30-day metrics: profile views, CV clicks, website clicks, follower growth, artwork views, applications submitted, opportunities saved | ✅ |
| Notes tab | View and delete notes the artist has left on studio updates | ✅ |
| Provenance Alerts | Pending artwork transfer requests from patrons | ✅ |

### `/profile/edit` — Edit profile
| Feature | What it does | Status |
|---------|-------------|--------|
| Avatar upload | Upload to `avatars` storage bucket | ✅ |
| Featured banner upload | Upload to `featured` storage bucket; transformed to 1600px on display | ✅ |
| Full name, username, bio | Core profile fields | ✅ |
| Country, disciplines, mediums, career stage | Classification fields | ✅ |
| Exhibition history editor | Add/edit/delete exhibition entries | ✅ |
| Bibliography editor | Add/edit/delete press/publication entries | ✅ |
| Received grants | Tag-style input for listing past grants received; drives "Grant Recipient" badge | ✅ |
| CV upload | Upload CV PDF to `cvs` storage bucket | ✅ |
| Professional CV upload | Separate CV field (patron-facing; used for job opportunity applications) | ✅ |
| Website URL | External link shown on profile | ✅ |
| Digest subscription toggle | Opt in/out of weekly opportunity digest email | ✅ |
| Collection visibility toggle | Show/hide patron collection on profile | ✅ |
| Support section toggle | Enable/disable the Support tab on public profile | ⚠️ Toggle works; payment flow not implemented |
| Account termination | Soft-deletes profile and all associated data | ✅ |

### `/[username]` — Own public profile (artist view)
All visitor features apply, plus:
| Feature | What it does | Status |
|---------|-------------|--------|
| Edit profile link | Shortcut to `/profile/edit` | ✅ |
| New studio update button | Opens CreateUpdateModal | ✅ |
| Delete own studio updates | Per-update delete with storage cleanup | ✅ |
| Manage available works | Link to works management page | ✅ |

### `/profile/works` — Portfolio & works management
| Feature | What it does | Status |
|---------|-------------|--------|
| Portfolio section | Archival works (portfolio_images table); add, edit, delete, set position, mark featured | ✅ |
| Add portfolio work | Upload image/audio/video/text/embed to portfolio | ✅ |
| Toggle archive visibility | Hide individual works from public archive | ✅ |
| Available works section | For-sale listings (artworks table); add new, set price/currency (NZD/AUD), manage listing | ✅ |
| Add available work | Upload image, set title, price, discipline, description | ✅ |
| Edit available work | Update title, price, description, discipline | ✅ |
| Unlist work | Removes from public marketplace (sets `is_available=false`) | ✅ |
| Toggle hide from public | Hides work from profile without delisting | ✅ |
| Delete artwork | Removes record and storage file | ✅ |
| Sold works section | Transferred works with buyer, sale price, transfer date | ✅ |
| Hide sold work from archive | Toggle `hide_from_archive` per work | ✅ |

### `/projects/[id]` — Project thread
| Feature | What it does | Status |
|---------|-------------|--------|
| Multi-update timeline | Ordered list of studio updates in a project | ✅ |
| Create project | Group updates into a named thread | ✅ |
| Add notes | Comment on studio updates | ✅ |
| Delete own notes | Remove own comments | ✅ |
| Content-type aware rendering | Image / audio / video / text / embed per update | ✅ |

### `/feed` — Studio feed (logged in)
| Feature | What it does | Status |
|---------|-------------|--------|
| Create new update | Opens CreateUpdateModal with type picker (Image / Audio / Video / Writing / Embed) | ✅ |
| Image update | Upload image, set caption, discipline, project link | ✅ |
| Audio update | Upload audio file, set caption | ✅ |
| Video update | Upload video file or embed URL, set caption | ✅ |
| Writing update | Rich text content, set caption | ✅ |
| Embed update | Paste embed URL (YouTube, Vimeo, Spotify, SoundCloud, etc.) | ✅ |
| Delete own update | Removes record and storage files | ✅ |

### `/messages` — Conversations list
| Feature | What it does | Status |
|---------|-------------|--------|
| View all conversations | List of DM threads with unread indicators | ✅ |
| Unread count badge | Shows count of unread messages in NavBar | ✅ |

### `/messages/[conversationId]` — Chat
| Feature | What it does | Status |
|---------|-------------|--------|
| Send and receive text messages | Real-time via Supabase Realtime | ✅ |
| Mark as read on open | Clears unread count | ✅ |
| Transfer work to patron | Initiate artwork ownership transfer (creates transfer_request message) | ✅ |
| Accept/decline transfer request | Artist accepts incoming patron transfer request; ownership updated | ✅ |
| Work detail card rendering | Shows artwork image, title, price in message thread | ✅ |
| Enquiry context banner | Shows disclaimer on first message if conversation initiated via enquiry | ✅ |
| Email notification to recipient | Fire-and-forget email on new message | ✅ |

### `/opportunities/[id]` — Pipeline application
| Feature | What it does | Status |
|---------|-------------|--------|
| Apply button (pipeline) | Opens ApplyModal | ✅ |
| ApplyModal | Dynamic form with opportunity's custom fields; attach portfolio artwork | ✅ |
| Save application draft | `src/app/opportunities/[id]/actions.ts::saveDraft` — upserts draft | ✅ |
| Submit application | Creates opportunity_applications record; sends confirmation email to artist | ✅ |
| Duplicate application guard | Cannot submit twice to same opportunity | ✅ |

### `/analytics` — Profile analytics
| Feature | What it does | Status |
|---------|-------------|--------|
| Total followers | Count + gained this month | ✅ |
| Follower list | With message button per follower | ✅ |
| Profile views (30d) | Chart of daily views | ✅ |
| CV downloads (30d) | Click count | ✅ |
| Website clicks (30d) | Click count | ✅ |
| Artwork views (30d) | Aggregate across all works | ✅ |
| Applications submitted | Count | ✅ |
| Opportunities saved | Count | ✅ |

---

## Patron

*Role: `patron`*

Patrons inherit all visitor browsing features. Below are patron-specific features.

### `/dashboard` — Patron dashboard
| Feature | What it does | Status |
|---------|-------------|--------|
| Saved tab | Bookmarked opportunities | ✅ |
| Applied tab | Job/Employment pipeline applications submitted | ✅ |
| Applications tab | Status tracker for job applications | ✅ |
| Provenance Alerts | Pending artwork transfers the patron initiated (waiting for artist to accept) | ✅ |
| Analytics tab | Followers, profile views (limited — patrons have fewer metrics than artists) | ✅ |

### `/profile/edit` — Edit patron profile
| Feature | What it does | Status |
|---------|-------------|--------|
| All standard profile fields | Name, bio, avatar, banner, website | ✅ |
| Professional CV upload | Private CV for job opportunity applications | ✅ |
| Collection visibility toggle | Show/hide acquired works on public profile | ✅ |

### `/[username]` — Patron public profile
| Feature | What it does | Status |
|---------|-------------|--------|
| Collection section | Shows artworks the patron has acquired | ✅ |
| Standard profile tabs | Overview, Work (if any), CV & Press | ✅ |

### Collecting & works
| Feature | What it does | Status |
|---------|-------------|--------|
| View available works on artist profile | Sees works listed for sale with price | ✅ |
| Enquire about work | Opens conversation with artist via EnquireButton | ✅ |
| Make offer on artwork | Structured offer card (amount + currency) sent in chat | ✅ |
| Receive transfer from artist | Artist initiates ownership transfer; patron accepts in chat | ✅ |
| View own collection | Patron's acquired works shown on own profile | ✅ |
| Provenance certificate | Issued as message attachment on transfer_accepted | ✅ |

### Messaging
| Feature | What it does | Status |
|---------|-------------|--------|
| Message any artist directly | No follower restriction for patrons | ✅ |
| Initiate enquiry thread | Attaches context about the work enquired on | ✅ |
| Real-time chat | Supabase Realtime subscription | ✅ |

### Following
| Feature | What it does | Status |
|---------|-------------|--------|
| Follow artist | Adds to follows table; artist sees follower in analytics | ✅ |
| Unfollow artist | Removes follow | ✅ |

### Pipeline (Job opportunities only)
| Feature | What it does | Status |
|---------|-------------|--------|
| Apply to Job/Employment pipeline opportunities | Same ApplyModal as artists; attaches professional CV | ✅ |
| Track application status | Same Applications tab as artists | ✅ |

---

## Partner

*Role: `partner`*

Partners are organisations or galleries that list opportunities on Patronage.

### `/partners` — Partner info & opportunity submission
| Feature | What it does | Status |
|---------|-------------|--------|
| Value proposition page | Explains listing options (external vs pipeline), pricing | ✅ |
| Opportunity submission form | Full form: title, organiser, description, type, country, deadline, funding, image | ✅ |
| Routing type toggle | External (sends users to partner website) vs Pipeline (manage applications on Patronage) | ✅ |
| Custom questions builder | Add custom fields for pipeline applications (short text, long text, checkbox, dropdown) | ✅ |
| Submit for review | Creates opportunity with `status=pending`; admin reviews in queue | ✅ |

### `/claim-listing/[token]` — Claim an existing listing
| Feature | What it does | Status |
|---------|-------------|--------|
| Claim via email token | Partners receive claim link via email; clicking assigns `opportunity.profile_id` to their account | ✅ |
| Token expiry | One-time use; expired tokens redirect with error message | ✅ |

### `/partner/dashboard` — Partner dashboard
| Feature | What it does | Status |
|---------|-------------|--------|
| Live pipeline opportunities | Cards showing each active pipeline opportunity with application counts (pending / shortlisted / selected) | ✅ |
| Submissions queue | Partner's own pending/rejected submissions awaiting admin review | ✅ |
| All listings | Full list of all claimed or partner-created opportunities | ✅ |
| Link to manage each opportunity | Edit, view applications | ✅ |

### `/partner/opportunities/[id]/edit` — Edit opportunity
| Feature | What it does | Status |
|---------|-------------|--------|
| Full opportunity editor | Title, organiser, description, type, country, city, deadline, opens_at, funding, routing type, custom fields | ✅ |
| Publish/unpublish toggle | Controls `is_active` flag | ✅ |
| Delete opportunity | Permanent delete | ✅ |
| Save changes | Updates record in database | ✅ |

### `/partner/dashboard/[opportunityId]` — Application submissions
| Feature | What it does | Status |
|---------|-------------|--------|
| Application list | Table of all applicants with name, date applied, status badge | ✅ |
| Applicant detail panel | Shows applicant bio, disciplines, career stage, submitted answers to custom questions, attached artwork | ✅ |
| Status workflow | pending → shortlisted → selected → approved_pending_assets → production_ready → rejected | ✅ |
| Shortlist button | Moves application to shortlisted | ✅ |
| Select button | Moves to selected; creates profile_achievement record for artist | ✅ |
| Approve & request assets | Moves to approved_pending_assets; triggers email to artist requesting high-res upload | ✅ |
| Reject button | Moves to rejected | ✅ |
| Download high-res asset | Once artist uploads, partner can request signed URL and download from `production-assets` bucket | ✅ |
| Real-time status updates | Supabase Realtime subscription keeps table live without refresh | ✅ |
| CV download (job type) | For Job/Employment opportunities, shows link to download applicant's CV | ✅ |

### Partner profile
| Feature | What it does | Status |
|---------|-------------|--------|
| Edit profile | Same as other roles — name, bio, avatar, banner | ✅ |
| Public profile page | Shows partner's listed opportunities | ✅ |

---

## Admin / Owner

*Role: `admin` or `owner`*

Admins have access to all user-facing features plus the admin panel.

### `/admin` — Admin dashboard
| Feature | What it does | Status |
|---------|-------------|--------|
| Platform overview stats | Artist count, patron count, partner count, signups this week, active/inactive profiles | ✅ |
| Opportunity stats | Active listings, inactive listings, by type, by country | ✅ |
| Transfers & value | Art transfer count, total transfer value | ✅ |
| Grant performance (30d) | Per-opportunity: title, read-more clicks, external link click-throughs, report link | ✅ |
| Medium trends (30d) | Bar chart of engagement by discipline | ✅ |
| Artist quality metrics | Verified count, profile completion % | ✅ |
| Retention metrics | WAU, MAU, stickiness ratio | ✅ |
| Opportunity engagement | Avg saves/opportunity, CTR, pipeline applications (all-time + 30d), pipeline completion rate | ✅ |
| Partner health | Active listers, repeat listers, pipeline adoption % | ✅ |
| Growth metrics | Subscriber count, signups by role (this week + this month) | ✅ |
| Admin tools menu | Links to all management interfaces | ✅ |

### `/admin/opportunities` — Manage opportunities
| Feature | What it does | Status |
|---------|-------------|--------|
| Search & filter listings | Search by title/organiser; filter by status/type | ✅ |
| Pagination | 50 per page | ✅ |
| Activate/deactivate listing | Toggle `is_active` flag | ✅ |
| Edit opportunity inline | AdminEditOpportunityModal — full field editor | ✅ |
| View engagement report | Links to per-opportunity report page | ✅ |
| Delete listing | Permanent delete | ✅ |
| Reject pending submission | Marks status=rejected | ✅ |

### `/admin/opportunities/queue` — Scraper queue
| Feature | What it does | Status |
|---------|-------------|--------|
| Review auto-scraped opportunities | Table of pending scraped opportunities | ✅ |
| Publish scraped opportunity | Sets status=published; makes it live | ✅ |
| Reject scraped opportunity | Sets status=rejected; removes from queue | ✅ |
| Bulk actions | QueueControls component for publish-all / reject-all | ✅ |

### `/admin/opportunities/[id]/report` — Opportunity engagement report
| Feature | What it does | Status |
|---------|-------------|--------|
| Read-more click count | How many times "read more" was expanded | ✅ |
| External link click count | Click-throughs to organiser's website | ✅ |
| Save count | How many users saved this opportunity | ✅ |
| Application count | How many pipeline applications submitted | ✅ |

### `/admin/submissions` — Review partner submissions
| Feature | What it does | Status |
|---------|-------------|--------|
| Pending submissions | List of partner-submitted opportunities awaiting review | ✅ |
| Reviewed submissions | Previously approved/rejected submissions | ✅ |
| Publish submission | Sets status=published; sends notification email to partner | ✅ |
| Reject submission | Sets status=rejected; logs reason | ✅ |
| Delete submission | Permanent delete | ✅ |
| Edit before publishing | AdminEditOpportunityModal for inline edits before approval | ✅ |

### `/admin/artists` — Manage artists
| Feature | What it does | Status |
|---------|-------------|--------|
| Search artists | Search by name/username | ✅ |
| Pagination | 50 per page | ✅ |
| Activate/deactivate profile | Toggle profile active status | ✅ |
| Mark as Patronage Supported | Adds "Patronage Supported" badge to artist profile | ✅ |
| Delete profile | Soft delete | ✅ |

### `/admin/digest` — Weekly digest management
| Feature | What it does | Status |
|---------|-------------|--------|
| Preview next digest | Shows new opportunities this week + closing in next 7 days | ✅ |
| Export subscriber list | `GET /api/admin/subscribers` — downloads CSV | ✅ |
| Send digest | `POST /api/admin/send-digest` — triggers Resend email to all subscribers | ✅ |

### `/admin/impact` — Impact report
| Feature | What it does | Status |
|---------|-------------|--------|
| Funding flow by type & region | Aggregate funding amounts by opportunity type and country | ✅ |
| Artist demographics | Career stage breakdown, country breakdown | ✅ |
| Economic multiplier metrics | Estimated career trajectory impact | ⚠️ Calculations are estimates; no verified methodology |
| Annual data export | CSV export of full annual data | ✅ |
| Annual report generation | ExportButtons — generates formatted report | ⚠️ Basic implementation |

### `/admin/upload` — CSV bulk import
| Feature | What it does | Status |
|---------|-------------|--------|
| Upload CSV of opportunities | CsvUploader component; maps columns to opportunity fields | ✅ |
| Bulk insert | `src/app/admin/upload/actions.ts::uploadOpportunitiesCSV` — multi-insert via Supabase | ✅ |

### `/api/parse-opportunity` — AI opportunity parser
| Feature | What it does | Status |
|---------|-------------|--------|
| Parse opportunity from URL | Admin pastes URL; Claude Haiku extracts structured opportunity data | ✅ |
| Returns pre-filled form data | JSON with title, organiser, description, deadline, funding, type, etc. | ✅ |

### `/api/admin/grant-report` — Grant engagement report
| Feature | What it does | Status |
|---------|-------------|--------|
| Per-opportunity engagement data | Read-more clicks, link click-throughs, saves, applications | ✅ |

---

## API Routes

| Route | Method | Auth | What it does | Status |
|-------|--------|------|-------------|--------|
| `/api/search` | GET | None | Full-text search across opportunities and artists | ✅ |
| `/api/feed` | GET | None | Paginated studio feed (cursor-based) | ✅ |
| `/api/opportunities/[id]/view` | POST | Required | Increment opportunity view_count | ✅ |
| `/api/public/opportunities` | GET | None | Public opportunities feed (for external integrations) | ✅ |
| `/api/public/artists` | GET | None | Public artists directory (for external integrations) | ✅ |
| `/api/parse-opportunity` | POST | Admin | AI-powered opportunity extraction from URL | ✅ |
| `/api/admin/send-digest` | POST | Admin | Trigger weekly digest email via Resend | ✅ |
| `/api/admin/subscribers` | GET | Admin | Export subscriber list as CSV | ✅ |
| `/api/admin/grant-report` | GET | Admin | Opportunity engagement metrics | ✅ |

---

## Cross-Role Feature Matrix

| Feature | Visitor | Artist | Patron | Partner | Admin |
|---------|:-------:|:------:|:------:|:-------:|:-----:|
| Browse opportunities | ✓ | ✓ | ✓ | ✓ | ✓ |
| Filter & search opportunities | ✓ | ✓ | ✓ | ✓ | ✓ |
| View opportunity detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save opportunity | — | ✓ | ✓ | ✓ | ✓ |
| Apply to pipeline opportunity | — | ✓ | ✓† | — | ✓ |
| Browse artists | ✓ | ✓ | ✓ | ✓ | ✓ |
| View public artist profile | ✓ | ✓ | ✓ | ✓ | ✓ |
| Follow artist | — | ✓ | ✓ | — | ✓ |
| Message user | — | ✓‡ | ✓ | ✓ | ✓ |
| Edit own profile | — | ✓ | ✓ | ✓ | ✓ |
| Upload portfolio | — | ✓ | — | — | — |
| Create available works | — | ✓ | — | — | — |
| Post studio updates | — | ✓ | — | — | — |
| Create projects | — | ✓ | — | — | — |
| Transfer / collect works | — | ✓ | ✓ | — | — |
| View own collection | — | — | ✓ | — | — |
| List opportunities | — | — | — | ✓ | ✓ |
| Manage pipeline applications | — | — | — | ✓ | ✓ |
| Claim listing via token | — | — | — | ✓ | — |
| Admin dashboard | — | — | — | — | ✓ |
| Manage all users | — | — | — | — | ✓ |
| Manage all listings | — | — | — | — | ✓ |
| Send digest email | — | — | — | — | ✓ |
| Access scraper queue | — | — | — | — | ✓ |
| Bulk CSV import | — | — | — | — | ✓ |
| View impact report | — | — | — | — | ✓ |

† Patrons can only apply to Job/Employment type pipeline opportunities.
‡ Artists can only message users who already follow them; patrons can message any artist without restriction.

---

## Features in Code with No UI Entry Point

These exist as server actions or API routes but are not reachable via any current navigation:

| Feature | Location | Notes |
|---------|----------|-------|
| `GET /api/public/opportunities` | `src/app/api/public/opportunities/route.ts` | Public REST endpoint; no UI consumer — intended for external integrations |
| `GET /api/public/artists` | `src/app/api/public/artists/route.ts` | Same as above |
| `trackEvent()` | `src/actions/trackEvent.ts` | Called inline from components; not exposed directly |
| `getSignedAssetUrl()` | `src/app/partner/dashboard/actions.ts` | Callable only when status=`production_ready`; partner must be on the correct dashboard page |
| Profile analytics page | `src/app/profile/analytics/page.tsx` | Reachable from `/profile/analytics` directly but not linked from main NavBar; linked from dashboard analytics tab |

---

## Stubbed / Roadmap Items

| Feature | Current State | Notes |
|---------|--------------|-------|
| Artist support / patronage tab | Toggle exists; tab renders if `support_enabled=true` | No payment processing integrated; support flow not implemented |
| Secondary market (patron-to-patron transfers) | Data model supports it (`current_owner_id` on artworks); transfer flow only supports artist → patron direction | Post-MVP roadmap item |
| Opportunity brokering | No UI | Planned: Blake finds opps for artists; no implementation |
| Direct institution listings | Pipeline form exists; no onboarding flow for councils/institutions | Roadmap: replacing Google Forms for local councils |
| Commission/contract management | No contract workflow | Not started |
| Bulk artist verification | Manual admin toggle only | No batch tool |
| Digest preview before send | Preview renders in `/admin/digest` but no staging/test-send to single address | Minor UX gap |
| Economic multiplier methodology | Admin impact report shows estimates | Calculations are not based on a verified methodology; figures are illustrative |
| MakeOfferModal (patron) | Component exists (`src/components/messages/MakeOfferModal.tsx`); `message_type: 'work_offer'` in schema | Offer card appears in chat; no acceptance/counter-offer workflow beyond free-text negotiation |
