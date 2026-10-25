import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResultEmails } from "@/lib/email";
import { MIN_WEEKLY_VIEWS, buildProfileViewsEmail, type WeeklyProfileStats } from "@/lib/profile-views-email";

const DAY_MS = 86_400_000;
const EVENT_TYPES = ["profile_view", "cv_click", "website_click", "artwork_view"];
const PAGE = 1000;

interface EventRow {
  event_type: string;
  payload: { profile_id?: string } | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  email_verified_at: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_minor: boolean | null;
  profile_view_emails: boolean | null;
  digest_unsubscribe_token: string;
}

/** Monday morning in NZ (Sunday 19:00 UTC): tells artists how many people viewed their profile last week. */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = { profilesWithViews: 0, eligible: 0, sent: 0, failed: 0, errors: [] as string[] };

  const now = Date.now();
  const sinceWeek = new Date(now - 7 * DAY_MS).toISOString();
  const sincePrev = new Date(now - 14 * DAY_MS).toISOString();

  // Two weeks of events, paged: the current week plus the week before for the trend.
  const events: EventRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("analytics_events")
      .select("event_type, payload, created_at")
      .in("event_type", EVENT_TYPES)
      .gte("created_at", sincePrev)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      results.errors.push(`events: ${error.message}`);
      return NextResponse.json(results, { status: 500 });
    }
    events.push(...((data ?? []) as EventRow[]));
    if (!data || data.length < PAGE) break;
  }

  const empty = (): WeeklyProfileStats => ({ views: 0, prevViews: 0, cvClicks: 0, websiteClicks: 0, artworkViews: 0 });
  const stats = new Map<string, WeeklyProfileStats>();
  for (const e of events) {
    const id = e.payload?.profile_id;
    if (!id) continue;
    const s = stats.get(id) ?? empty();
    const current = e.created_at >= sinceWeek;
    if (e.event_type === "profile_view") {
      if (current) s.views++;
      else s.prevViews++;
    } else if (current) {
      if (e.event_type === "cv_click") s.cvClicks++;
      else if (e.event_type === "website_click") s.websiteClicks++;
      else if (e.event_type === "artwork_view") s.artworkViews++;
    }
    stats.set(id, s);
  }

  const candidates = [...stats.entries()].filter(([, s]) => s.views >= MIN_WEEKLY_VIEWS);
  results.profilesWithViews = candidates.length;
  if (candidates.length === 0) return NextResponse.json(results);

  const profiles = new Map<string, ProfileRow>();
  const ids = candidates.map(([id]) => id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from("profiles")
      .select(
        "id, username, full_name, email, email_verified_at, bio, avatar_url, is_minor, profile_view_emails, digest_unsubscribe_token"
      )
      .in("id", ids.slice(i, i + 200))
      .in("role", ["artist", "owner"]);
    if (error) {
      results.errors.push(`profiles: ${error.message}`);
      continue;
    }
    for (const p of (data ?? []) as ProfileRow[]) profiles.set(p.id, p);
  }

  const emails = candidates.flatMap(([id, s]) => {
    const p = profiles.get(id);
    if (!p?.email || !p.email_verified_at || p.is_minor || p.profile_view_emails === false) return [];
    const { subject, html } = buildProfileViewsEmail({
      name: p.full_name,
      username: p.username,
      stats: s,
      hasBio: !!p.bio?.trim(),
      hasAvatar: !!p.avatar_url,
      unsubscribeToken: p.digest_unsubscribe_token,
    });
    return [{ key: id, to: p.email, subject, html }];
  });
  results.eligible = emails.length;
  if (emails.length === 0) return NextResponse.json(results);

  const failed = await sendResultEmails(emails);
  results.failed = failed.length;
  results.sent = emails.length - failed.length;
  return NextResponse.json(results);
}
