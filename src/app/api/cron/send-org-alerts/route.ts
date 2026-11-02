import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResultEmails } from "@/lib/email";
import { buildOrgAlertEmail, type OrgAlertItem } from "@/lib/org-alerts";
import { nzDatePlus } from "@/lib/deadline-reminders";
import { isShadowEmail } from "@/lib/shadow";

interface OppRow {
  id: string;
  slug: string | null;
  title: string;
  organiser: string;
  type: string;
  deadline: string | null;
  organiser_profile_id: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  opportunity_alerts: boolean | null;
  digest_unsubscribe_token: string;
}

/**
 * Daily: tell followers of an organisation about listings it has newly
 * published (223). Each listing is alerted once — `followers_alerted_at` is
 * stamped after the run, whether or not it had followers, so a listing linked
 * to its organiser later still alerts if it is open, and never twice.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = { listings: 0, followers: 0, sent: 0, failed: 0, notified: 0, errors: [] as string[] };

  const today = nzDatePlus(0);
  const { data: oppData, error: oppErr } = await admin
    .from("opportunities")
    .select("id, slug, title, organiser, type, deadline, organiser_profile_id")
    .eq("status", "published")
    .eq("is_active", true)
    .not("organiser_profile_id", "is", null)
    .is("followers_alerted_at", null)
    .or(`deadline.gte.${today},deadline.is.null`);
  if (oppErr) return NextResponse.json({ ...results, errors: [oppErr.message] }, { status: 500 });

  const opps = (oppData ?? []) as OppRow[];
  results.listings = opps.length;
  if (opps.length === 0) return NextResponse.json(results);

  const orgIds = [...new Set(opps.map((o) => o.organiser_profile_id))];
  const { data: followRows, error: followErr } = await admin
    .from("follows")
    .select("follower_id, following_id")
    .in("following_id", orgIds);
  if (followErr) return NextResponse.json({ ...results, errors: [followErr.message] }, { status: 500 });

  // follower → the new listings from every organisation they follow
  const byFollower = new Map<string, OppRow[]>();
  for (const f of followRows ?? []) {
    if (f.follower_id === f.following_id) continue;
    const items = opps.filter((o) => o.organiser_profile_id === f.following_id);
    byFollower.set(f.follower_id, [...(byFollower.get(f.follower_id) ?? []), ...items]);
  }
  results.followers = byFollower.size;

  if (byFollower.size > 0) {
    // follower_id points at auth.users, so profiles can't be embedded: look them up after.
    const { data: profs, error: profErr } = await admin
      .from("profiles")
      .select("id, email, email_verified_at, opportunity_alerts, digest_unsubscribe_token")
      .in("id", [...byFollower.keys()]);
    if (profErr) results.errors.push(`profiles: ${profErr.message}`);
    const profiles = (profs ?? []) as ProfileRow[];

    // In-app notifications go to every follower with a profile (notifications
    // references profiles); the email respects the opt-out.
    const notifications = profiles.flatMap((p) =>
      byFollower.get(p.id)!.map((o) => ({
        user_id: p.id,
        type: "org_opportunity",
        title: `New from ${o.organiser}: ${o.title}`,
        body: null,
        link: `/opportunities/${o.slug ?? o.id}`,
      }))
    );
    if (notifications.length > 0) {
      const { error: notifyErr } = await admin.from("notifications").insert(notifications);
      if (notifyErr) results.errors.push(`notifications: ${notifyErr.message}`);
      else results.notified = notifications.length;
    }

    const emails = profiles
      .filter((p) => p.email && p.email_verified_at && !isShadowEmail(p.email) && p.opportunity_alerts !== false)
      .map((p) => {
        const items: OrgAlertItem[] = byFollower.get(p.id)!.map((o) => ({
          title: o.title,
          organiser: o.organiser,
          type: o.type,
          deadline: o.deadline,
          href: `/opportunities/${o.slug ?? o.id}`,
        }));
        const { subject, html } = buildOrgAlertEmail({ items, unsubscribeToken: p.digest_unsubscribe_token });
        return { key: p.id, to: p.email!, subject, html };
      });

    if (emails.length > 0) {
      const failed = await sendResultEmails(emails);
      results.failed = failed.length;
      results.sent = emails.length - failed.length;
    }
  }

  const { error: stampErr } = await admin
    .from("opportunities")
    .update({ followers_alerted_at: new Date().toISOString() })
    .in("id", opps.map((o) => o.id));
  if (stampErr) results.errors.push(`stamp: ${stampErr.message}`);

  return NextResponse.json(results);
}
