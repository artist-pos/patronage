import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResultEmails } from "@/lib/email";
import { buildProfileViewsEmail, hasWeeklyNews, type WeeklyProfileStats } from "@/lib/profile-views-email";

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

/**
 * Monday morning in NZ (Sunday 19:00 UTC): tells artists how their work was
 * received last week — appreciations, saves and profile views. Private numbers,
 * one email, skipped in a week with nothing to say.
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

  const empty = (): WeeklyProfileStats => ({
    views: 0, prevViews: 0, cvClicks: 0, websiteClicks: 0, artworkViews: 0, appreciations: 0, saves: 0,
  });
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

  // Appreciations (225) and saves (224) this week. Private counts for the
  // artist only; a failure here just leaves them out of this week's email.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("update_appreciations")
      .select("artist_id")
      .gte("created_at", sinceWeek)
      .range(from, from + PAGE - 1);
    if (error) {
      results.errors.push(`appreciations: ${error.message}`);
      break;
    }
    for (const r of (data ?? []) as Array<{ artist_id: string }>) {
      const s = stats.get(r.artist_id) ?? empty();
      s.appreciations++;
      stats.set(r.artist_id, s);
    }
    if (!data || data.length < PAGE) break;
  }

  const saveRows: Array<{ artist_id: string; board_id: string }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("board_items")
      .select("artist_id, board_id")
      .gte("created_at", sinceWeek)
      .range(from, from + PAGE - 1);
    if (error) {
      results.errors.push(`saves: ${error.message}`);
      break;
    }
    saveRows.push(...((data ?? []) as typeof saveRows));
    if (!data || data.length < PAGE) break;
  }
  if (saveRows.length > 0) {
    // Same rule as board_save_counts(): own saves and organisation shortlists don't count.
    const boardIds = [...new Set(saveRows.map((r) => r.board_id))];
    const owners = new Map<string, string>();
    for (let i = 0; i < boardIds.length; i += 200) {
      const { data } = await admin.from("boards").select("id, owner_id").in("id", boardIds.slice(i, i + 200));
      for (const b of data ?? []) owners.set(b.id, b.owner_id);
    }
    const ownerIds = [...new Set(owners.values())];
    const partners = new Set<string>();
    for (let i = 0; i < ownerIds.length; i += 200) {
      const { data } = await admin.from("profiles").select("id").eq("role", "partner").in("id", ownerIds.slice(i, i + 200));
      for (const p of data ?? []) partners.add(p.id);
    }
    for (const r of saveRows) {
      const owner = owners.get(r.board_id);
      if (!owner || owner === r.artist_id || partners.has(owner)) continue;
      const s = stats.get(r.artist_id) ?? empty();
      s.saves++;
      stats.set(r.artist_id, s);
    }
  }

  const candidates = [...stats.entries()].filter(([, s]) => hasWeeklyNews(s));
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
