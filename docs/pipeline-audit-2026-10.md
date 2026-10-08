# Pipeline audit — organisation setup to close-out (8 Oct 2026)

Scope: the whole open-call ("pipeline") product, from an organisation creating a listing through to artists being told the outcome and the opportunity finishing. Read from code, plus read-only checks of the production database and the live site. **No code was changed.**

**How verified.** Everything below is from reading the code unless marked *(data)*, which means I queried the database `.env.local` points at (it holds the Bridge Housing partner profile, so it is production). I could not log in as a partner, so UI behaviour is derived from the components, not clicked through.

---

## 1. The 5–7 emails — what's actually going on

**I can't pin the exact sequence Jennifer triggered, because the evidence is gone** *(data)*: the Bridge Housing opportunity no longer exists in the database. Deleting an opportunity cascades to its applications, status log and notification queue, so there are no application rows, no `application_status_log` rows and no queue rows left to read. Only a profile achievement survives, with `opportunity_id = null`.

What the code shows is that **nothing on the server stops the same email being sent repeatedly**, and four things in the UI make repeating likely.

### Root cause: no idempotency in `updateApplicationStatus`
[src/app/partner/dashboard/actions.ts:131-169](src/app/partner/dashboard/actions.ts:131) sends the shortlist / rejection email every time the action is called with that status. `oldStatus` is read (line 80) and logged, but never compared to the new status. The same is true of the selection email ([actions.ts:251-288](src/app/partner/dashboard/actions.ts:251)). Setting "Rejected" on an already-rejected application emails them again.

### What makes it fire repeatedly
1. **Panel and list views don't share state.** The decision panel keeps its own `status` ([ApplicantPanel.tsx:119](src/components/partner/ApplicantPanel.tsx:119)) and never reports back to the board. The board's views copy their props once (`useState(apps)` at [TableView.tsx:19](src/components/partner/pipeline/TableView.tsx:19), [KanbanView.tsx:57](src/components/partner/pipeline/KanbanView.tsx:57), [TriageView.tsx:20](src/components/partner/pipeline/TriageView.tsx:20)) and the shell does the same ([OpportunityShell.tsx:109](src/components/partner/OpportunityShell.tsx:109)). So after you reject someone in the panel, the table still says "New", and re-opening the panel offers "Reject" again. The server's `revalidatePath` refetch is ignored by all of them.
2. **The panel isn't keyed per applicant.** Using the ‹ › arrows to move between applicants keeps the previous person's `status` state ([OpportunityShell.tsx:380](src/components/partner/OpportunityShell.tsx:380) has no `key`). The next applicant shows the previous one's decision, and the button for that status is disabled for the wrong person.
3. **Bulk "Move to…" re-applies to everyone selected**, including people already in that status ([TableView.tsx:54-68](src/components/partner/pipeline/TableView.tsx:54)). Select all, move to Rejected, do it again: everyone is emailed again.
4. **Triage keyboard shortcuts** (`s`, `a`, `x`) have no `e.repeat` guard and no confirmation ([TriageView.tsx:39-72](src/components/partner/pipeline/TriageView.tsx:39)). Holding a key fires the action repeatedly. The listener is on `window`, so it keeps firing while the applicant modal is open on top.
5. **Undo re-sends.** The panel's Undo calls the same action ([ApplicantPanel.tsx:560-565](src/components/partner/ApplicantPanel.tsx:560)), so undoing a shortlist and re-doing it sends another email.

By design a successful artist also legitimately gets up to three: shortlisted, selected, then approved-pending-assets (high-res request). Add any of the above on top and 5–7 follows easily.

### Fix (one change removes the class of bug)
- In `updateApplicationStatus`, return early without side-effects when `oldStatus === status`.
- Add a send ledger: unique `(application_id, notification_type)` with `sent_at`, and insert-before-send so a second call can't send. This also covers double-clicks and two reviewers acting at once.
- Make the client views derive from props (or a shared store) instead of copying them, and add `key={application.id}` to `ApplicantPanel`.

---

## 2. Critical

### C1. "Hold" doesn't hold — it silently loses the email *(data)*
The `notification_queue` table does not exist in the database (`PGRST205`; migration 145 was never run). In `updateApplicationStatus` the queue insert's error is never checked ([actions.ts:152-160](src/app/partner/dashboard/actions.ts:152), [270-278](src/app/partner/dashboard/actions.ts:270)), so a partner who chooses "Hold" gets **no email sent and nothing in the Notifications panel**. The panel just says "No queued notifications" ([BatchNotificationPanel.tsx:90](src/components/partner/BatchNotificationPanel.tsx:90)).

### C2. The wizard shows "Hold" as the default, but the server treats a missing setting as "Send"
`WizardShell` defaults to shortlisted = hold, rejected = hold, selected = send ([WizardShell.tsx:72-76](src/components/partner/wizard/WizardShell.tsx:72)) and highlights those buttons, but only saves the setting when the partner clicks one. The server falls back to `"send"` ([actions.ts:136](src/app/partner/dashboard/actions.ts:136)). A partner who never touched step 5 sees "Hold" selected, but every status change emails the artist immediately. This is the most likely reason an organisation thought it was in control of timing and wasn't.

### C3. A partner can publish their own listing, mark it paid, or feature it
`updateOpportunityPartner` spreads whatever the client sends into the update ([edit/actions.ts:116-120](src/app/partner/opportunities/[id]/edit/actions.ts:116)). The "partners cannot change status…" comment is only a TypeScript type, which isn't enforced at runtime. The RLS policy is just `auth.uid() = profile_id` with no column limits ([025_profile_opportunities.sql:16](supabase/migrations/025_profile_opportunities.sql:16)), and I found no protective trigger. Any partner can send `status: "published"`, `pipeline_paid_at`, `is_featured` or `is_active` through the server action or directly via Supabase, skipping admin review and the $200 fee. `relistOpportunity` ([actions.ts:588](src/app/partner/dashboard/actions.ts:588)) also sets `published` on any listing, whatever its state. Fix: allow-list fields in the action, and add a trigger or column grants for `status`, `is_active`, `is_featured`, `pipeline_paid_at`, `profile_id`.

### C4. There is no archive — finishing an opportunity means deleting it
The only ways to retire a listing are Delist (hides it) or permanent Delete, which cascades to every application, score, status log and queued email ([037](supabase/migrations/037_opportunity_applications.sql), [145](supabase/migrations/145_notification_queue.sql)). Two delete paths exist: admin ([admin/opportunities/actions.ts:76](src/app/admin/opportunities/actions.ts:76)) and the owner ([profile/opportunity-actions.ts:93](src/app/profile/opportunity-actions.ts:93), which has no pipeline check at all). The admin dialog says "cannot be undone" but never mentions that applications go too.

This is what happened to Bridge Housing *(data)*: the row is gone, and `/partners` still links to it ([partners/page.tsx:238-243](src/app/partners/page.tsx:238)), which now shows "Opportunity not found". Even when a closed listing survives, the page says "Applications closed" plus recovery suggestions, and `/partners` still labels it "See the open call".
Recommend: an `archived` state that keeps the page and applications, hides it from browse, and renders as a case study ("Completed — 38 applications, 1 commissioned"); block hard-delete when applications exist.

---

## 3. High

| # | Finding | Where |
|---|---|---|
| H1 | **Status filter chips and "N new to review" don't filter** the table/board/triage views, because they copy `apps` once. | [OpportunityShell.tsx:347-349](src/components/partner/OpportunityShell.tsx:347) |
| H2 | **Only the panel asks for confirmation and a reason.** Table hover ✕, bulk, Kanban drag and Triage `x` reject instantly and email the artist with *no feedback text*. The ✕/↑ buttons are `opacity-0` until hover, so invisible on touch. | [TableView.tsx:214-232](src/components/partner/pipeline/TableView.tsx:214) |
| H3 | **Every selected artist is told to "create your campaign page" with a QR code**, whether or not the opportunity uses campaigns. A utility-box commission like Bridge Housing gets an irrelevant call to action. Queued version links to `/studio/qr-codes` regardless. | [email.ts:946](src/lib/email.ts:946), [actions.ts:280](src/app/partner/dashboard/actions.ts:280) |
| H4 | **Artist dashboard labels contradict the emails.** `selected` shows "Shortlisted — You've been shortlisted"; `production_ready` shows "Approved — you've been selected"; `shortlisted` shows "Under Review". Partner's custom stage labels aren't used. | [ApplicationsTab.tsx:48-55](src/components/dashboard/ApplicationsTab.tsx:48) |
| H5 | **Partners can't see or mark invoices paid.** The shell hard-codes `invoice_requested_at/amount/paid_at: null` ([OpportunityShell.tsx:381-387](src/components/partner/OpportunityShell.tsx:381)), so the "Mark as paid" button and the artist's "payment confirmed" email are unreachable. | |
| H6 | **No audit trail in the UI.** The Activity tab reads `status_log`, but the dashboard page never loads it, so it always says "No status changes recorded." That is the view that would have answered the email question. The log insert is also an un-awaited `void` ([actions.ts:122](src/app/partner/dashboard/actions.ts:122)). | [page.tsx:97](src/app/partner/dashboard/[opportunityId]/page.tsx:97) |
| H7 | **"Required" questions aren't required.** The builder has a Required toggle; neither `ApplyForm` nor `submitApplication` checks it, and labels carry no asterisk. | [FormBuilderPanel.tsx:282](src/components/partner/wizard/FormBuilderPanel.tsx:282) |
| H8 | **"Terms accepted" is untrue.** The reviewer panel says so when a T&C PDF exists, but the apply form only offers a "View documents" link — there is no acceptance step or stored consent. | [ApplicantPanel.tsx:347](src/components/partner/ApplicantPanel.tsx:347), [ApplyForm.tsx:1431](src/components/opportunities/ApplyForm.tsx:1431) |
| H9 | **`submitApplication` doesn't check the listing is open, published or paid.** The closed/pipeline checks live in the page only. A direct call can apply after the deadline. | [opportunities/[id]/actions.ts:167](src/app/opportunities/[id]/actions.ts:167) |
| H10 | **"First round free" isn't implemented.** `isPipelineFirstRound` is referenced in a comment but doesn't exist. Every unpaid pipeline listing is sent to a $200 page ([new/actions.ts:157](src/app/partner/opportunities/new/actions.ts:157)), and admin approval throws until it's paid ([submissions/actions.ts:27](src/app/admin/submissions/actions.ts:27)). The activate page contradicts itself: "first open call is free — this applies from your second listing onwards" ([activate/page.tsx:35](src/app/partner/opportunities/[id]/activate/page.tsx:35)). | |
| H11 | **Organisation gets no feedback loop.** No email or in-app notice on: new application, payment received, listing approved, listing rejected (silent, no reason). After paying, Stripe returns to `/edit?activation=success`, which immediately redirects to `/manage` and drops the param, so there's no confirmation. | [submissions/actions.ts](src/app/admin/submissions/actions.ts), [edit/page.tsx](src/app/partner/opportunities/[id]/edit/page.tsx) |
| H12 | **Viewer collaborators see controls they can't use, and can see more than the matrix says.** Decision buttons and Export show for everyone ("Not authorised" on click); the role is discarded (`void collaboratorRole`, [page.tsx:65](src/app/partner/dashboard/[opportunityId]/page.tsx:65)). Per the matrix viewers can't export, yet get applicant emails in the panel and CSV; scoring is allowed for any collaborator ([scoring/actions.ts:22](src/app/partner/dashboard/scoring/actions.ts:22)) though the matrix says viewers can't. | |
| H13 | **The 6/12-month follow-ups and studio-update reminders aren't scheduled anywhere in the repo.** `vercel.json` has only the digest cron and the workflows are scrape/score. These are advertised on `/partners` ("Report") and the activate page. Confirm whether they're scheduled outside the repo. | [vercel.json](vercel.json) |

---

## 4. Medium

- **Slow review loop.** The dashboard page makes one `admin.auth.getUserById` call per applicant on every render ([page.tsx:160-162](src/app/partner/dashboard/[opportunityId]/page.tsx:160)), and every status change `revalidatePath`s that page, so a 50-applicant call does ~50 auth lookups per click, and bulk fires them all in parallel. Slow responses invite re-clicks. Fetch emails on demand (panel open / export) instead.
- **Fire-and-forget on Vercel.** `void (async () => …)()` after the response can be cut off when the function freezes: emails and log rows can be dropped. Use `after()` from `next/server` or await.
- **Reversals leave residue.** Selecting creates a verified profile achievement, a public studio-feed post and possibly a campaign; moving the artist to Rejected or Pending removes none of them ([actions.ts:175-249](src/app/partner/dashboard/actions.ts:175)). The project upsert (`onConflict: "artist_id"`) means a second selection never posts.
- **`closeOpportunity` overwrites the deadline with today** ([actions.ts:565](src/app/partner/dashboard/actions.ts:565)); there is no reopen, and "Re-publish" doesn't restore it, so the listing shows closed again the next day. Pipeline listings also don't require a deadline.
- **Typo:** "2 scoring criterion**a**" ([StepReviewPublish.tsx:85](src/components/partner/wizard/StepReviewPublish.tsx:85)).
- **Navigation:** "‹ Partner Dashboard" and `/partner/dashboard` both land on `/studio`.
- **Payment request** emails the artist's bank account number in plain text to the partner and can be re-sent without limit ([dashboard/payment-actions.ts](src/app/dashboard/payment-actions.ts)).
- **`submitDraftForReview`** has no status guard (a published listing could be pushed back to `pending`) and notifies admins before payment is made ([new/actions.ts:119](src/app/partner/opportunities/new/actions.ts:119)).
- A question type `checkbox` exists in the type but `ApplyForm` renders anything not short/long as a file upload ([ApplyForm.tsx:78](src/components/opportunities/ApplyForm.tsx:78)).
- `ApplicationsManager.tsx` (735 lines) is dead code; only its types are imported.

---

## 5. What works well
- Applicant detail panel is strong: tabs for application / portfolio / CV / activity, inline PDF and image rendering, per-work descriptions labelled as "written for this application".
- The panel's confirm dialog with an optional reason/personal message is the right pattern — it just needs to be the only route.
- Post-selection flow (assets, documentation, payment request) and per-stage relabelling are well thought through.
- Draft saving on the apply form; anonymous pre-auth listing flow.
- Idempotent webhook handler for the activation payment ([pipeline-handler.ts:28](src/lib/commerce/pipeline-handler.ts:28)).

---

## 6. Suggested order of work
1. **Stop the emails:** transition guard + send ledger (§1). Small, and removes the Jennifer problem.
2. **Close the self-publish hole (C3).**
3. **Run migration 145**, check the insert error, and make the wizard's displayed defaults the saved defaults (C1, C2).
4. **Add archive; block hard-delete with applications; repoint `/partners`** (C4).
5. **Single source of truth for the review board** (H1, §1.1–1.2), confirmation for every reject path (H2).
6. Copy/label fixes: selected email, artist status labels, "criteriona" (H3, H4).
7. Enforce required questions and add a real T&C acceptance (H7, H8); server-side open check (H9).
8. Org feedback loop and first-round-free decision (H10, H11); schedule the crons (H13).

## 7. Not covered
Roster / org-invite / outreach tooling, the admin claim-token flow, the scraper, Stripe Connect payouts, and the rubric builder internals. I did not run the app against a partner account, so layout, mobile behaviour and accessibility of these screens are untested.

---

## 8. Implementation status (8 Oct 2026)

Implemented in the working tree, not yet committed. `tsc` and `npm run build` pass. **Run `supabase/migrations/197_pipeline_audit_fixes.sql` in the Supabase SQL Editor**; the code degrades safely without it (held emails report a warning instead of vanishing, archive reports that it needs the migration) but Hold, the send ledger, archive and the column protection only work once it has run.

| Finding | Status |
|---|---|
| E1 duplicate emails | Done: changed-status guard, conditional update, send ledger, shared board state, panel keyed per applicant |
| C1 Hold loses emails | Done in code (errors checked and shown, flush claims rows, stale rows cancelled); needs migration 197 for the table |
| C2 default mismatch | Done: one shared default used by wizard, manage screen and server |
| C3 self-publish | Done: field allow-list in the action plus a database trigger (migration 197) |
| C4 archive / delete | Done: archive, restore, reopen; delete refused when applications exist; `/partners` dead link removed |
| C5 no listings page | Done: `/partner/dashboard` restored and linked from card, sidebar, redirects |
| H1–H2 | Done: filters work; every reject/select confirms with optional reason; bulk skips unchanged |
| H3, H4 | Done: campaign copy only when the opportunity uses campaigns; artist labels corrected |
| H5, H6 | Done: invoices and status history reach the panel |
| H7, H8, H9 | Done: required questions, recorded terms acceptance, server-side open/published/deadline check |
| H10 | Done: first open call stamped free in code; copy corrected |
| H11 | Done: emails and in-app notices for new application, payment received, approval, rejection (with reason); confirmation banner after Stripe |
| H12 | Done: viewers see read-only controls, no export, no applicant emails, cannot score |
| H13 | Done: follow-up and reminder crons added to `vercel.json` (needs `CRON_SECRET` set in Vercel) |
| M1, M2 | Done: emails load on demand; sends run in `after()` |
| M3 | Partly: achievement removed when moved out of selected stages; feed post and campaign are not reversed |
| M4 | Done: close no longer overwrites the deadline; reopen added |
| M5, M6, M8, M9, M10 | Done |
| M7 | Partly: re-send limited to once an hour; account number is still emailed |

## 9. Review workflow and held results (8 Oct 2026, second pass)

Built on top of section 8, driven by decisions made after the re-audit. Not committed. `tsc` and `npm run build` pass.

**Run in this order in the Supabase SQL Editor, before deploying:** `197_pipeline_audit_fixes.sql`, then `198_reviewer_role.sql` on its own (an enum value can't be used in the transaction that adds it), then `199_review_workflow.sql`. Several artist-facing queries read `released_status`, so deploying before 199 breaks them.

| Area | What changed |
|---|---|
| Reviewers without an account | Invite by email creates a light `reviewer` account and sends a magic link (via the existing `/auth/confirm`) to `/review/[id]`. Invite email now actually sends. Email lookup no longer misses users past the first 50. Anyone who applied to the call can't be invited to review it. Sign-in page re-sends a fresh link, rate-limited. |
| Account prompt | Guest reviewers get a banner offering patron, artist, or "join the organisation" (files them under it). Never blocks the work. |
| Review queue | `/review` and `/review/[id]`: next unscored applicant, progress bar, 1-to-N scoring per criterion, team notes. |
| Assignment | Everyone reviews everything, split evenly (N per application, balanced, rebalanced on add/remove), or manual per application. New applications are assigned on arrival. |
| Scores on the board | Score column with reviewers-done count, spread warning, sort by score, "Shortlist the top N". Editors see others' scores only after finishing that application. |
| Silent decisions | Moving a card never emails or publishes. Achievement, studio post and campaign also wait. |
| Results tab | Preview grouped by outcome, per-group message, email preview, typed `SEND`, one email per person, retry-safe. |
| Artist view | Artists see only `released_status` ("Received" until published). Feedback and file requests follow the same rule. |
| Fee | Automatic free first round removed. Admin review shows whether it's their first call and offers "Approve, fee waived" or "Request $200 fee". |
| Organiser summary | One email a day with new-application counts (cron `send-application-summary`) instead of one per application. |
| Partner home | `/dashboard` is role-aware: organisers see their listings there. `/partner/dashboard` and a partner's `/studio` redirect to it; submitting lands there. Admins use `/dashboard?view=partner`. |
| Artist email links | Now open the artist's applications instead of the studio home. |

### Revision (same day)

- **Decisions are private at the database level.** The organiser's working decision now lives in `application_decisions`, which artists cannot read. `opportunity_applications.status` is only ever what the artist has been told. Migration 199 was rewritten accordingly (it had not been run).
- **Published results are final.** After publishing, an outcome can only move forward through the delivery stages (selected, files requested, files received). A rejection is permanent, a shortlisted applicant can't return to New, and a selection can't be reversed. Enforced on the server and reflected in the buttons. There is deliberately **no undo for a send**.
- **Rubric criteria** still lock when the first score is saved, so everyone is judged on the same criteria. The wording (name and helper text) of a locked criterion can now be corrected; weight, scale and the list itself stay fixed.
- **Tier 2 built:** blind review (hides names, locations, profiles and CVs from reviewers, who work in the queue), conflict of interest (a reviewer can step back; their scores are removed and they are never assigned it again), a per-criterion disagreement table, and suggested wording for result messages.
- **Not built:** must-have eligibility flags (required questions are enforced at submission, which covers most of it), a send undo (rejected by design), and response templates beyond suggested wording.
