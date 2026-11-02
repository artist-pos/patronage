# Social layer — Phase 1 spec

Four features that make Patronage more interactive without turning it into another feed to perform on. Each one feeds the loop on the About page — *an organisation creates an opportunity → artists apply → the work gets made → the record makes the next one easier* — and none of them needs a public number.

Status: all four features built (migrations 223–226), not yet deployed. Feature 4 does not yet use pipeline application data or label recurring rounds; every opportunity uses self-reports for now. Thresholds are enforced in SQL (`get_opportunity_outcomes`), and tips need an admin's approval at `/admin/outcome-tips` before they appear. The shared-board link lives at `/boards/shared/[token]`, not on the profile namespace.

**Build order:** 1 → 2 → 3 → 4, each shipped on its own. Features 1–3 are self-contained. Outcome reports carry the most moderation, aggregation and privacy risk, so they go last.

The test for every detail is the product principle in CLAUDE.md: Patronage is a tool for doing things, not a place for appearing to do things.

---

## Principles (already in the codebase — keep them)

| Principle | Where it lives today |
|---|---|
| The opportunity comes first | About page loop; homepage closes on "Start with one opportunity" |
| Numbers are private, and go to the artist | `follows` — "the public UI must NEVER display a public follower number" (016); profile views arrive as a private Monday email (220) |
| The artist controls their own space | Artist toggles note visibility (016); `admin_hidden` hides without deleting (177) |
| Patrons can stay anonymous | Private supporter mode — relationship public, identity private (170) |
| Community is structured, not a crowd | Cohorts, alumni, rosters, collectives, regions, local boards; open community chat was dropped (196) |
| Runnable by one person | Rate limits (191), daily send budgets (205), silent moderation |

Every feature below is checked against these. If a later change breaks one, it needs a reason written down.

---

## 1. Follow organisations

**Why:** following an organisation means hearing when it posts an opportunity. That is step one of the loop, delivered to the right person.

**Data:** reuse `follows`. No new table.

The follow is the relationship; opportunity alerts are only its first use. Keep the two separate so later organisation activity (exhibition or commission announcements, programme updates, calls for expressions of interest) can reach followers without a new relationship. The alert preference therefore lives on the follower's profile, not on the `follows` row.

- `follows.following_id` references `auth.users(id)`. Checked 2026-11-01: all 35 partner profiles, including the 15 shadow ones, have an `auth.users` row, so organisations can be followed as-is and no FK change is needed. Shadow accounts created later must keep that property.
- **Coverage is the real constraint.** Only 15 of 102 open published opportunities have an `organiser_profile_id`, and they come from just 4 organisations. A follow button that only appears on linked listings would show on about one listing in seven. Before launch, link organisers on existing listings to the 35 partner accounts (an admin pass, helped by matching `organiser` text to partner names), and link new listings from now on.
- Add `opportunity_alerts boolean not null default true` to `profiles` for the opt-out, matching `profile_view_emails` (220).

**UI:**
- Follow button on `/partners/[slug]` and on the opportunity detail page beside the organiser name ("Follow Creative NZ"). Shown only when `organiser_profile_id` is set — scraped listings with free-text organisers get no button.
- Partner dashboard shows the organisation its own follower count. Nowhere else.

**Alerts:**
- Daily cron: opportunities that became `published` in the last 24h with an `organiser_profile_id` → one batched email per follower ("2 new opportunities from organisations you follow"). Respects the daily send budget.
- In-app notification type `org_opportunity` (extend the `notifications_type_check`, as 204 did).

**Edge cases:** an org that archives (`archived_at`) is still followable; recurring opportunities alert on each new round only, not on edits.

---

## 2. Saves and boards

**Why:** a save is intent; a like is applause. Saves tell an artist a work is wanted, and boards turn saving into something useful: an organisation's shortlist, or a patron's shortlist of work they might buy or commission.

Boards are collections of things someone might act on, not of things they like. One system, three behaviours: an artist keeps references, a patron keeps works they might acquire, an organisation keeps artists it might commission. Copy, empty states and actions should point at the next step (enquire, commission, invite to apply).

Opportunity saves stay in `user_saved_opportunities` (036) — that's the career dashboard and shouldn't be merged.

**Data (migration 224):**

```sql
create table boards (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  -- 'public' is reserved for later; Phase 1 exposes private and link only.
  visibility  text not null default 'private'
              check (visibility in ('private', 'link', 'public')),
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (owner_id, slug)
);

create table board_items (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  item_type   text not null check (item_type in ('artwork', 'update', 'artist')),
  item_id     uuid not null,
  -- Denormalised so the artist can read save counts without seeing boards.
  artist_id   uuid not null references profiles(id) on delete cascade,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (board_id, item_type, item_id)
);
```

**Integrity:** `item_id` points at one of three tables, so there's no ordinary foreign key.
- A `before insert` trigger checks the item exists in the table `item_type` names and sets `artist_id` from it (the client never supplies `artist_id`).
- `after delete` triggers on `artworks`, `project_updates` and `profiles` remove matching `board_items`. A deleted work disappears from boards quietly; no "item removed" placeholder.
- Hidden items (`admin_hidden` updates, unlisted works) stay on the board for its owner but aren't shown on link-shared boards.

**RLS:**
- Owner manages own boards and items.
- `link` boards readable by anyone with the slug (same model as `private_rooms`, 131).
- No public boards in Phase 1. Public boards raise questions about ownership, privacy and expectations; add them once we've seen how people use boards. When they arrive, private supporters (`profiles.private_supporter = true`) can't make a board public.
- Artists **never** read `board_items` directly. Save counts come from a security-definer function returning counts for the caller's own `artist_id` only — no who, no which board.

**UI:**
- Save icon on feed tiles, work pages and artist cards → small sheet: pick a board or "New board". First save auto-creates "Saved".
- Boards live under the user's dashboard, with a "Copy link" share for link visibility.
- Studio: "Saved 9 times" on the artist's own works and updates. Never shown to anyone else.

**Organisation shortlists (the important case):**
- A partner saving artists builds a shortlist. From a board, "Invite to apply" picks one of the partner's open opportunities and sends each artist a notification (`opportunity_invite`) plus an email linking to it.
- Shortlists are invisible to the artist until they are invited. Being saved by an organisation is not reported in the artist's save count.
- Inviting artists who aren't on Patronage yet stays with the existing invite flow (187).

---

## 3. Appreciations (private likes)

**Why:** a one-tap way to tell an artist "this landed", with the count going only to them — the same rule as follows.

**Data (migration 225):**

```sql
-- Private appreciation. Same rule as follows (016): the count is for the
-- artist and admin only; the public UI must never show it.
create table update_appreciations (
  update_id   uuid not null references project_updates(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  artist_id   uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (update_id, user_id)
);
```

**RLS:** users insert/delete their own rows and read their own (so the icon shows filled); the artist reads rows where `artist_id = auth.uid()`.

**UI:** a small mark on feed tiles and update detail. The viewer sees only their own toggled state. No counts, no "liked by" list, no sorting by appreciation.

**Reporting:** extend the Monday email (`src/app/api/cron/send-profile-views/route.ts`) instead of adding another one. Same opt-out. Keep it a note, not an analytics report: lead with a human line ("Your work is getting noticed" or "12 people appreciated your updates this week"), then the plain breakdown of views, appreciations and saves. Skip the email in a week with nothing to say rather than sending zeros.

Phase 1 covers feed updates only. Works are covered by saves.

---

## 4. Outcome reports on opportunities

**Why:** artists trust other artists on whether a round is worth applying for. Structured answers give real information without public reviews of the organisations Patronage depends on.

**Data (migration 226):**

```sql
create table opportunity_outcomes (
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  applied        boolean not null,
  result         text check (result in ('selected', 'shortlisted', 'unsuccessful', 'no_response')),
  response_weeks integer check (response_weeks between 0 and 52),
  tip            text check (tip is null or char_length(tip) <= 280),
  tip_hidden     boolean not null default false,   -- admin-set, like admin_hidden
  private_note   text check (private_note is null or char_length(private_note) <= 1000),
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, user_id),
  -- Results only mean something from people who applied.
  check (applied or (result is null and response_weeks is null))
);
```

`applied` is the denominator. Someone who saved but didn't apply can still leave a tip, but never counts towards response or selection figures.

**RLS:** users manage their own row. Nobody reads other rows directly; the public page reads an aggregate view plus visible tips (without names). `private_note` is admin-only.

**Prompt:** six weeks after the deadline, email everyone who saved the opportunity or marked it applied in `user_saved_opportunities`: "Did you apply to X? Two questions." This reuses the deadline-reminder pattern (218/219). One prompt per opportunity per person.

**Display on the opportunity page:** thresholds differ by how identifying the information is.

| Information | Shown from | Example |
|---|---|---|
| Participation | 3 reports | "Reported by 4 artists" |
| Response and selection figures | 5 applied reports | "4 of 6 heard back · typical reply 5 weeks" |
| Anonymous tips | 5 reports, admin-reviewed | Listed newest first |

- Any figure of 1 or 2 is shown as "a few", never as a number, so an unusual outcome in a small pool doesn't point at one person. Selection counts aren't shown at all in Phase 1; who was selected is usually public anyway.
- Tips need the higher threshold, not a lower one: a tip's wording identifies its author far more easily than a count does. They're held for a quick admin check before they appear.
- Treat these as minimums. For very small rounds (recipients ≤ 2, or a known small pool) show participation only.
- Pipeline opportunities use real data from `opportunity_applications` for response times rather than self-reports.
- Recurring opportunities show the last round's figures, labelled with the round.

**Moderation:** tips are public, so an admin reviews them before they show and can hide them later (`tip_hidden`). Complaints go in `private_note`, which reaches only the Patronage team. Organisations can't edit or delete reports. A right of reply is Phase 2.

---

## Notifications and email summary

| Event | In-app | Email |
|---|---|---|
| Followed org publishes an opportunity | `org_opportunity` | Daily batch |
| Org invites you to apply | `opportunity_invite` | Immediate |
| Your work/update was saved or appreciated | — | Monday digest (existing email) |
| Opportunity you saved closed six weeks ago | — | One outcome prompt |

No new email lists except the `opportunity_alerts` opt-out. Everything respects the daily send budget.

---

## Out of scope (Phase 2 or later)

Quote-with-a-work responses · provenance stories from owners · supplier credits (framers, printers) · following disciplines, regions and projects · web push (PWA) · public and collaborative boards · organisation right of reply on outcomes · curators.

The direction for these is in [social-phase-2-3.md](social-phase-2-3.md). Two Phase 2 items grow straight out of this phase:

- **Private notes on saved artists** for organisations ("met at exhibition", "suited to large-scale public work"). It's what turns a shortlist into a commissioning tool used between rounds.
- **Organisation records of completed work.** Link the artists and artworks behind an organisation's programmes, commissions, exhibitions or developments to its profile. Together with shortlists and invites, an organisation could run a commission end to end on Patronage and keep the record afterwards, which is a reason to keep using it after an opportunity closes. It builds on residency alumni (186) and cohorts (206).

---

## How we'll know it worked

Check before starting Phase 2:

- Share of active users who have saved at least one thing.
- Organisations followed per artist, and click-through on opportunity alerts.
- Outcome prompt response rate, and how many opportunities reach the 5-report threshold.
- Partner use of "Invite to apply".

If saves are low, Phase 2 features won't fix that — revisit placement first.

---

## Open questions

1. ~~Do shadow organisation profiles have `auth.users` rows?~~ Yes (checked 2026-11-01). The open question is now coverage: should the scraper or admin queue suggest an organiser link for every new listing, and should frequent organisers without an account get a shadow account so they can be followed?
2. Should patrons see other patrons' public boards on their profiles, or only by link at first?
3. Do boards need their own spot in the mobile tab bar, or live under the profile?
4. Are the outcome thresholds (3 / 5 / 5) right for small NZ rounds? Check them against a few real rounds before launch.
