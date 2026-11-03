import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CLAIM_FROM,
  bodyToHtml,
  buildDeclineUrl,
  buildOptOutFooter,
  getResend,
  logClaimInviteToCRM,
} from "@/lib/claim-invite";
import { buildShadowClaimEmail, getOrCreateShadowClaimToken, shadowClaimUrl } from "@/lib/shadow-claims";
import {
  buildClaimOnlyBody,
  buildClaimUrl,
  buildTemplateSubject,
} from "@/app/admin/opportunities/claim-templates";

/**
 * Daily, ~9am NZ. Emails the organiser of an aggregated listing nobody has
 * claimed, with the claim link, once per address, ever.
 *
 * Off until CLAIM_AUTOSEND_ENABLED=true: without it this only reports who it
 * would email, so the first runs can be read before anything goes out.
 *   CLAIM_AUTOSEND_DAILY_CAP   max emails per run (default 10; raise slowly to protect the sending domain)
 *   CLAIM_AUTOSEND_COUNTRIES   comma list of opportunities.country values (default "NZ")
 * Add ?dry=1 to force a dry run even when enabled.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mailboxes nobody reads, and addresses that belong to the platforms we aggregate from.
const ROLE_LOCAL = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|abuse|privacy|unsubscribe)$/i;
const BLOCKED_DOMAINS = new Set(["submittable.com", "slideroom.com", "artshub.com.au", "eventbrite.com", "mailchimp.com"]);

interface Candidate {
  id: string;
  title: string;
  organiser: string | null;
  contact_email: string | null;
  claim_email: string | null;
  claim_contact_name: string | null;
  claim_current_tool: string | null;
  created_at: string;
  view_count: number | null;
  organiser_profile_id: string | null;
}

/**
 * Only an address a person confirmed at approval (claim_email) is emailed
 * automatically. The scraper's contact_email is a guess from page text until then.
 */
function pickEmail(c: Candidate): string | null {
  const raw = (c.claim_email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(raw) || raw.length > 200) return null;
  const [local, domain] = raw.split("@");
  if (ROLE_LOCAL.test(local) || BLOCKED_DOMAINS.has(domain)) return null;
  return raw;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const enabled = process.env.CLAIM_AUTOSEND_ENABLED === "true" && req.nextUrl.searchParams.get("dry") !== "1";
  const cap = Math.max(1, Math.min(50, Number(process.env.CLAIM_AUTOSEND_DAILY_CAP) || 10));
  const countries = (process.env.CLAIM_AUTOSEND_COUNTRIES ?? "NZ").split(",").map((s) => s.trim()).filter(Boolean);

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const settled = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Published, live, unclaimed, never invited, with an address, old enough that
  // the scraper's dedupe has had a pass at it.
  const { data, error } = await admin
    .from("opportunities")
    .select("id, title, organiser, contact_email, claim_email, claim_contact_name, claim_current_tool, created_at, view_count, organiser_profile_id")
    .eq("status", "published")
    .eq("is_active", true)
    .is("profile_id", null)
    .is("claim_invite_sent_at", null)
    .in("country", countries)
    .or(`deadline.gte.${today},deadline.is.null`)
    .lt("created_at", settled)
    .not("claim_email", "is", null)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // One organisation, one account. A listing linked to an organisation that's
  // already on Patronage isn't invited at all. One linked to an unclaimed
  // (shadow) account invites the organisation to claim that account, which
  // brings its followers and every linked listing with it.
  const candidates = (data ?? []) as Candidate[];
  const orgIds = [...new Set(candidates.map((c) => c.organiser_profile_id).filter((id): id is string => !!id))];
  const orgs = new Map<string, { full_name: string | null; account_status: string }>();
  const invitedShadows = new Set<string>();
  if (orgIds.length > 0) {
    const [{ data: orgRows }, { data: tokenRows }] = await Promise.all([
      admin.from("profiles").select("id, full_name, account_status").in("id", orgIds),
      // A shadow already sent a claim (or claimed) isn't emailed again from here.
      admin.from("claim_tokens").select("entity_id").in("entity_id", orgIds).in("status", ["sent", "claimed"]),
    ]);
    for (const o of orgRows ?? []) orgs.set(o.id, o);
    for (const t of tokenRows ?? []) invitedShadows.add(t.entity_id);
  }
  const shadowOf = (c: Candidate) => {
    const org = c.organiser_profile_id ? orgs.get(c.organiser_profile_id) : undefined;
    return org?.account_status === "shadow" ? c.organiser_profile_id : null;
  };

  const byEmail = new Map<string, Candidate>();
  for (const c of candidates) {
    if (c.organiser_profile_id && orgs.has(c.organiser_profile_id) && !shadowOf(c)) continue;
    const shadowId = shadowOf(c);
    if (shadowId && invitedShadows.has(shadowId)) continue;
    const email = pickEmail(c);
    if (!email) continue;
    const best = byEmail.get(email);
    // One email per address: keep the listing with the most interest.
    if (!best || (c.view_count ?? 0) > (best.view_count ?? 0)) byEmail.set(email, c);
  }
  const emails = [...byEmail.keys()];
  if (emails.length === 0) return NextResponse.json({ enabled, eligible: 0, sent: 0 });

  // Anyone who has opted out, been emailed before (by hand or by this job), or is in the CRM.
  const [optouts, invited, crm] = await Promise.all([
    admin.from("claim_invite_optouts").select("email").in("email", emails),
    admin.from("opportunities").select("claim_invite_email").in("claim_invite_email", emails),
    admin.from("outreach_contacts").select("email").in("email", emails),
  ]);
  const skip = new Set<string>([
    ...((optouts.data ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()),
    ...((invited.data ?? []) as { claim_invite_email: string }[]).map((r) => r.claim_invite_email.toLowerCase()),
    ...((crm.data ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()),
  ]);

  // One email per organisation too: two addresses for the same shadow account
  // get one invite between them.
  const seenShadows = new Set<string>();
  const queue = emails
    .filter((e) => !skip.has(e))
    .sort((a, b) => (byEmail.get(b)!.view_count ?? 0) - (byEmail.get(a)!.view_count ?? 0))
    .filter((e) => {
      const s = shadowOf(byEmail.get(e)!);
      if (!s) return true;
      if (seenShadows.has(s)) return false;
      seenShadows.add(s);
      return true;
    })
    .slice(0, cap);

  const report: Array<{ email: string; organiser: string | null; title: string; status: string }> = [];
  let sent = 0;
  let failed = 0;

  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      note: "Dry run. Set CLAIM_AUTOSEND_ENABLED=true to send.",
      eligible: emails.length - emails.filter((e) => skip.has(e)).length,
      wouldSend: queue.map((e) => ({
        email: e,
        organiser: byEmail.get(e)!.organiser,
        title: byEmail.get(e)!.title,
        kind: shadowOf(byEmail.get(e)!) ? "organisation" : "listing",
      })),
    });
  }

  const resend = getResend();
  for (const email of queue) {
    const c = byEmail.get(email)!;

    // A true line about this listing, only when there's something to say.
    const { count: clicks } = await admin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "opportunity_click")
      .contains("payload", { opportunity_id: c.id });
    const engagement =
      (clicks ?? 0) > 0
        ? `${clicks === 1 ? "One creative has" : `${clicks} creatives have`} already clicked through to apply.`
        : undefined;

    // Fresh token for each send, valid 30 days: replies like Grace Butler's
    // ("I'll need to put it to the Foundation") come back weeks later.
    const token = crypto.randomUUID();
    const { error: tokenErr } = await admin
      .from("opportunities")
      .update({ claim_token: token, claim_token_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .eq("id", c.id);
    if (tokenErr) {
      failed++;
      report.push({ email, organiser: c.organiser, title: c.title, status: `token: ${tokenErr.message}` });
      continue;
    }

    const claimUrl = buildClaimUrl(token);
    const listingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/opportunities/${c.id}`;
    const organiser = c.organiser?.trim() || c.title;

    // The organisation already has an unclaimed account: invite it to claim
    // that, not this one listing. The listing token above still backs the
    // "don't email me again" link.
    const shadowId = shadowOf(c);
    let message: { subject: string; html: string };
    let shadowTokenId: string | null = null;
    if (shadowId) {
      const claim = await getOrCreateShadowClaimToken(admin, shadowId, { email, name: c.claim_contact_name });
      if (!claim) {
        failed++;
        report.push({ email, organiser: c.organiser, title: c.title, status: "shadow token failed" });
        continue;
      }
      shadowTokenId = claim.id;
      const { subject, html } = buildShadowClaimEmail({
        recipientName: c.claim_contact_name?.trim() || "team",
        entityLabel: orgs.get(shadowId)?.full_name ?? organiser,
        entityType: "partner",
        claimUrl: shadowClaimUrl(claim.token),
        context: `Your listing <strong>${c.title.replace(/</g, "&lt;")}</strong> is on it already.${engagement ? ` ${engagement}` : ""}`,
      });
      message = {
        subject,
        html: html.replace(
          "</body>",
          `<p style="font-size:12px;color:#888">Not the right person, or not interested? <a href="${buildDeclineUrl(token)}" style="color:#888">Let me know here</a> and I won't email you again.</p></body>`,
        ),
      };
    } else {
      const body = buildClaimOnlyBody({
        recipientName: c.claim_contact_name?.trim() || "team",
        organiserName: organiser,
        opportunityTitle: c.title,
        claimUrl,
        engagement,
        currentTool: c.claim_current_tool,
      });
      message = {
        subject: buildTemplateSubject("claim_only", c.title),
        html: bodyToHtml(`${body}\n\n${buildOptOutFooter(token)}`, claimUrl, listingUrl),
      };
    }

    const { error: sendErr } = await resend.emails.send({
      from: CLAIM_FROM,
      to: email,
      subject: message.subject,
      html: message.html,
    });

    if (sendErr) {
      failed++;
      report.push({ email, organiser: c.organiser, title: c.title, status: `send: ${(sendErr as { message?: string }).message ?? "failed"}` });
    } else {
      await admin
        .from("opportunities")
        .update({
          claim_invite_sent_at: new Date().toISOString(),
          claim_invite_email: email,
          claim_invite_template: "claim_only",
          claim_invite_auto: true,
        })
        .eq("id", c.id);
      if (shadowTokenId) {
        await admin
          .from("claim_tokens")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", shadowTokenId);
      }
      logClaimInviteToCRM(email, organiser, c.title).catch(console.error);
      sent++;
      report.push({ email, organiser: c.organiser, title: c.title, status: shadowId ? "sent (organisation)" : "sent" });
    }
    await new Promise((r) => setTimeout(r, 700)); // Resend rate limit
  }

  return NextResponse.json({ enabled: true, cap, sent, failed, report });
}
