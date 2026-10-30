import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CLAIM_FROM,
  bodyToHtml,
  buildOptOutFooter,
  getResend,
  logClaimInviteToCRM,
} from "@/lib/claim-invite";
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
    .select("id, title, organiser, contact_email, claim_email, claim_contact_name, claim_current_tool, created_at, view_count")
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

  const byEmail = new Map<string, Candidate>();
  for (const c of (data ?? []) as Candidate[]) {
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

  const queue = emails
    .filter((e) => !skip.has(e))
    .sort((a, b) => (byEmail.get(b)!.view_count ?? 0) - (byEmail.get(a)!.view_count ?? 0))
    .slice(0, cap);

  const report: Array<{ email: string; organiser: string | null; title: string; status: string }> = [];
  let sent = 0;
  let failed = 0;

  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      note: "Dry run. Set CLAIM_AUTOSEND_ENABLED=true to send.",
      eligible: emails.length - emails.filter((e) => skip.has(e)).length,
      wouldSend: queue.map((e) => ({ email: e, organiser: byEmail.get(e)!.organiser, title: byEmail.get(e)!.title })),
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
    const body = buildClaimOnlyBody({
      recipientName: c.claim_contact_name?.trim() || "team",
      organiserName: organiser,
      opportunityTitle: c.title,
      claimUrl,
      engagement,
      currentTool: c.claim_current_tool,
    });

    const { error: sendErr } = await resend.emails.send({
      from: CLAIM_FROM,
      to: email,
      subject: buildTemplateSubject("claim_only", c.title),
      html: bodyToHtml(`${body}\n\n${buildOptOutFooter(token)}`, claimUrl, listingUrl),
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
      logClaimInviteToCRM(email, organiser, c.title).catch(console.error);
      sent++;
      report.push({ email, organiser: c.organiser, title: c.title, status: "sent" });
    }
    await new Promise((r) => setTimeout(r, 700)); // Resend rate limit
  }

  return NextResponse.json({ enabled: true, cap, sent, failed, report });
}
