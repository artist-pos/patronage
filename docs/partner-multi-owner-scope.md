# Scope: multiple owners per partner account

**Status:** Phase 1 implemented (uncommitted, migration not yet run). See "Implementation notes" at the end; where it differs from the plan below, the notes win.
**Driver:** Partner organisations such as Continuum (an arts society) need several people to share ownership of one partner account, with everyone able to manage the profile and settings.

## Problem

A partner is a single `profiles` row (`role = 'partner'`) with one login. Ownership is checked everywhere as `profile_id = auth.uid()` (or `partner_id` / `partner_profile_id`). Only one person can run the account, so organisations share a password.

Related things that already exist but do not solve this:
- `opportunity_collaborators` (migration 072): per-listing viewer/editor/reviewer access. Stays, for outside reviewers.
- `collective_members` (migration 079): multi-admin pattern for artist collectives. Used as the model for the new table.
- `claim_tokens` (migration 151): hands a pre-built org profile to one claimant.

## Goals

- Any number of people can be members of a partner org.
- Every member is a full owner: profile, settings, listings, applications, review, roster, payments.
- Existing single-owner partners keep working with no action.
- Members keep their own personal profiles; the org profile stays a separate row.

## Non-goals

- Roles or permission tiers (all members are equal).
- Changing how artists, patrons or collectives work.
- Stripe Connect (artists only; partners do not use it).

## Design

1. **Table `partner_members`**: `partner_id` (to `profiles`, on delete cascade), `user_id` (to `profiles`, on delete cascade), `added_by`, `created_at`, `UNIQUE(partner_id, user_id)`. Index both FK columns.
2. **SQL helper `is_partner_member(partner_id uuid)`**: `security definer`, `stable`, fixed `search_path`. Used by every policy to avoid the recursive-RLS problem fixed in migration 192.
3. **Server helper `getActingPartnerId()`** (`src/lib/`): returns the org the user is acting as. Cookie-based selection (pattern: `src/lib/view-as.ts`), validated against membership on every call. Falls back to the user's own id for legacy partners.
4. **Invite flow**: owner enters an email, the invitee gets a magic link (reuse `inviteCollaborator` / `reviewLinkFor` pattern in `src/app/partner/opportunities/[id]/collaborators/actions.ts`), and accepting inserts a `partner_members` row. Creates a light account if none exists.
5. **UI**: a "Members" section in partner settings (list, invite, remove) and an org switcher in the header for users in more than one org.
6. **Backfill**: insert every existing `role = 'partner'` profile as a member of itself.
7. **Claim flow**: claiming a shadow org adds the claimant as a member instead of transferring the profile, so a second committee member can claim or join later.

## Work breakdown

### Phase 1: make multiple owners real
| Item | Notes |
|---|---|
| Migration `208_partner_members.sql` | Table, helper, RLS, indexes, backfill. Confirm numbering against the latest file first. |
| Policy rewrite migration | Drop and recreate partner-relevant policies to use `is_partner_member()`: 037, 071, 087, 112, 143, 144, 145, 146, 186, 197, 199, 206 (and `opportunities` owner policies from 025/064/166/197). Keep the `protect_opportunity_columns` trigger behaviour (197). |
| `src/app/partner/**` (~17 files) | Replace `user.id` ownership checks with acting-org id plus membership check. This is the bulk of the work. |
| `src/components/partner/PartnerDashboard.tsx` | 7 ownership checks. |
| `src/app/review/**`, `src/lib/review-assignment.ts`, `src/lib/collaborators.ts` | Org members count as implicit owners of all the org's listings. |
| Invite flow and Members UI | As above. |
| Settings, profile edit, `[username]` page edit permissions | Allow members to edit the org profile. |
| Onboarding and claim flow | `onboarding/partner*`, `claim/[token]` add a member row. |

### Phase 2: the rest of the org surface
| Item | Notes |
|---|---|
| Roster, cohorts, org-artist invitations (184 to 206) | Gate on membership. |
| Campaigns (`partner_profile_id`, migration 087) | Policies use the helper. |
| Payments | `pipeline_entry_payments.partner_id` and `featured_listing_payments.partner_id` select policies become membership checks; checkout code reads the acting org id. Any member may pay. |
| Admin tools | Show and manage members on `admin/profiles/[id]` and claim tokens. |

### Phase 3: messaging and polish
| Item | Notes |
|---|---|
| Messages | Shared org inbox: DMs addressed to the org are visible to every member. Needs a product check, since replies and unread counts must work per member. |
| Org switcher polish, notifications | Emails for the org (digests, application alerts) go to all members or the primary contact; decide per email type. |

## Decisions (defaults assumed)

1. **Roles:** none, all members equal. *(confirmed)*
2. **Messages:** shared org inbox. *(needs confirming; widest reach)*
3. **Payments:** any member can pay and view receipts.
4. **Last member:** removal of the last member is blocked; admin can recover access. Members can remove each other.
5. **Notifications:** org emails go to all members unless a per-type reason says otherwise.

## Risks

- **RLS recursion and regressions:** many policies are rewritten at once. Mitigation: one `security definer` helper, one migration, test as two users.
- **No automated tests in the app:** verify with `npx tsc --noEmit`, `npm run build`, and manual tests as owner A, owner B and a non-member.
- **Migrations are run manually in the Supabase SQL Editor:** the schema must be applied before deploying code that reads `partner_members`.
- **Shadow org accounts:** admin-created orgs with no login must still work; members are added at claim time.
- **Scraper:** not affected. It writes `opportunities` with the service role.

## Verification

- `npx tsc --noEmit` and `npm run build` clean.
- Manual: owner A invites B; B signs in and edits the profile, creates a listing, reviews applications; non-member C gets nothing; removing B revokes access; last-member removal is blocked.
- Existing single-owner partner still works with no changes.

## Implementation notes (Phase 1)

Differences from the plan above:
- **Migration is `223_partner_members.sql`**, not 208. It **adds** "org member" policies beside the existing owner policies instead of rewriting them (permissive policies are OR-ed), so single-login organisations are untouched.
- **No backfill and no self-row.** `is_org_member(org)` is true when `org = auth.uid()` or a `partner_members` row exists. The organisation's own login can therefore never be removed, which replaces the "last owner" rule.
- **Acting-org** is `getActingOrg()` in `src/lib/partner-org.ts` (cookie set by `GET /partner/switch?org=<id>`, re-validated each request). Forms that edit an organisation send an explicit `org_id`, never the cookie, so editing a personal profile can't land on an organisation.
- **Invites** reuse the guest-account pattern (profile role `reviewer`, magic link). A guest member's `/dashboard` shows the organisation.
- **Members page:** `/partner/members`. Org settings: `/settings?org=<id>`.

Not done (Phase 2/3 and known gaps):
- Shared org inbox for messages (messages still go to the organisation's own login).
- Org emails (digests, application alerts) still go to the organisation's own login only.
- `src/app/partners/actions.ts` (public submission form) still records the submitting user as payer.
- Removing an organisation avatar or banner leaves the old file in storage for members (storage delete policy is per user folder). The profile row is cleared correctly.
- Rate limiting on member invites.
- Nothing has been exercised against a real database or in the browser yet.

## Estimate

About 2 to 4 focused days: Phase 1 ~2 days, Phase 2 ~1 day, Phase 3 ~1 day (depends on the messaging decision).
