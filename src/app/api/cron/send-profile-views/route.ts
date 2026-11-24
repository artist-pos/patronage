import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResultEmails } from "@/lib/email";
import {
  MAX_COMPARISON_WEEKS,
  afterSnapshot,
  buildFirstLookEmail,
  buildProfileViewsEmail,
  hasWeeklyNews,
  type ProfileComparison,
  type ProfileSnapshot,
  type WeeklyProfileStats,
} from "@/lib/profile-views-email";
import { computeVerifiedProgress } from "@/lib/verified-progress";
import { DISCIPLINE_TO_MEDIUM } from "@/lib/disciplines";
import type { DisciplineEnum } from "@/types/database";

const DAY_MS = 86_400_000;
const EVENT_TYPES = ["profile_view", "cv_click", "website_click", "artwork_view"];
const PAGE = 1000;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/** New artists get their one first-look email once they are 3 to 14 days old. */
const FIRST_LOOK_MIN_DAYS = 3;
const FIRST_LOOK_MAX_DAYS = 14;

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
  disciplines: DisciplineEnum[] | null;
  country: string | null;
  is_minor: boolean | null;
  profile_view_emails: boolean | null;
  digest_unsubscribe_token: string;
}

const PROFILE_COLUMNS =
  "id, username, full_name, email, email_verified_at, bio, avatar_url, disciplines, country, is_minor, profile_view_emails, digest_unsubscribe_token";

type Admin = ReturnType<typeof createAdminClient>;

/** Each profile's work count and first three image URLs. */
async function loadWorks(admin: Admin, ids: string[]): Promise<Map<string, { count: number; images: string[] }>> {
  const out = new Map<string, { count: number; images: string[] }>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await admin
      .from("artworks")
      .select("profile_id, url, thumb_url")
      .in("profile_id", ids.slice(i, i + 100))
      .order("created_at", { ascending: false })
      .limit(5000);
    for (const w of (data ?? []) as Array<{ profile_id: string; url: string | null; thumb_url: string | null }>) {
      const entry = out.get(w.profile_id) ?? { count: 0, images: [] };
      entry.count++;
      const img = w.thumb_url ?? w.url;
      if (img && entry.images.length < 3) entry.images.push(img);
      out.set(w.profile_id, entry);
    }
  }
  return out;
}

function toSnapshot(p: ProfileRow, works: { images: string[] } | undefined): ProfileSnapshot {
  return {
    name: p.full_name?.trim() || p.username,
    username: p.username,
    bio: p.bio,
    avatarUrl: p.avatar_url,
    disciplines: (p.disciplines ?? []).map((d) => DISCIPLINE_TO_MEDIUM[d] ?? d.replace(/_/g, " ")),
    location: p.country,
    works: works?.images ?? [],
  };
}

/** A real, complete profile to compare against (PROFILE_EXAMPLE_USERNAME), if one is set and found. */
async function loadExample(admin: Admin): Promise<{ snapshot: ProfileSnapshot; url: string } | null> {
  const username = process.env.PROFILE_EXAMPLE_USERNAME?.trim();
  if (!username) return null;
  const { data } = await admin.from("profiles").select(PROFILE_COLUMNS).eq("username", username).maybeSingle();
  if (!data) return null;
  const p = data as ProfileRow;
  const works = await loadWorks(admin, [p.id]);
  const snapshot = toSnapshot(p, works.get(p.id));
  // Only a profile that really is complete makes a fair comparison.
  if (!snapshot.bio?.trim() || !snapshot.avatarUrl || snapshot.works.length < 3) return null;
  return { snapshot, url: `${SITE_URL}/${p.username}?utm_source=profile_views&utm_medium=email&utm_campaign=example` };
}

/**
 * Monday morning in NZ (Sunday 19:00 UTC): tells artists how their work was
 * received last week — appreciations, saves and profile views. Private numbers,
 * one email, skipped in a week with nothing to say.
 *
 * While a profile has a gap, the email also shows it next to a stronger one
 * (for at most MAX_COMPARISON_WEEKS emails). New artists with no news yet get a
 * one-off first-look email instead. Both replace the old day-2/day-7 nudges.
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
  const results = {
    profilesWithViews: 0,
    eligible: 0,
    sent: 0,
    failed: 0,
    withComparison: 0,
    firstLook: 0,
    errors: [] as string[],
  };

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

  // ── Who gets the weekly email ──────────────────────────────────────────────
  const profiles = new Map<string, ProfileRow>();
  const ids = candidates.map(([id]) => id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", ids.slice(i, i + 200))
      .in("role", ["artist", "owner"]);
    if (error) {
      results.errors.push(`profiles: ${error.message}`);
      continue;
    }
    for (const p of (data ?? []) as ProfileRow[]) profiles.set(p.id, p);
  }

  const weekly = candidates.filter(([id]) => {
    const p = profiles.get(id);
    return !!p?.email && !!p.email_verified_at && !p.is_minor && p.profile_view_emails !== false;
  });

  // The before-and-after: only for profiles with a gap, and only for the first
  // few weeks. If the log can't be read, send plain stats rather than risk
  // repeating it every week.
  const comparisonSends = new Map<string, number>();
  let logReadable = true;
  const needsComparisonCheck = weekly.map(([id]) => id);
  for (let i = 0; i < needsComparisonCheck.length; i += 200) {
    const { data, error } = await admin
      .from("profile_email_sends")
      .select("profile_id")
      .eq("kind", "weekly_comparison")
      .in("profile_id", needsComparisonCheck.slice(i, i + 200));
    if (error) {
      results.errors.push(`profile_email_sends (migration 231 run?): ${error.message}`);
      logReadable = false;
      break;
    }
    for (const r of (data ?? []) as Array<{ profile_id: string }>) {
      comparisonSends.set(r.profile_id, (comparisonSends.get(r.profile_id) ?? 0) + 1);
    }
  }

  const works = logReadable ? await loadWorks(admin, weekly.map(([id]) => id)) : new Map();
  const exampleData = logReadable ? await loadExample(admin) : null;

  const kindByKey = new Map<string, "weekly_comparison" | "first_look">();
  const outgoing: Array<{ key: string; to: string; subject: string; html: string }> = [];

  for (const [id, s] of weekly) {
    const p = profiles.get(id)!;
    const progress = computeVerifiedProgress(p, works.get(id)?.count ?? 0);

    let comparison: ProfileComparison | null = null;
    if (logReadable && !progress.verified && (comparisonSends.get(id) ?? 0) < MAX_COMPARISON_WEEKS) {
      const now = toSnapshot(p, works.get(id));
      comparison = {
        now,
        after: afterSnapshot(now, exampleData?.snapshot ?? null),
        missing: progress.missing,
        exampleUrl: exampleData?.url ?? null,
      };
      kindByKey.set(id, "weekly_comparison");
    }

    const { subject, html } = buildProfileViewsEmail({
      name: p.full_name,
      username: p.username,
      stats: s,
      hasBio: progress.hasBio,
      hasAvatar: progress.hasAvatar,
      unsubscribeToken: p.digest_unsubscribe_token,
      comparison,
    });
    outgoing.push({ key: id, to: p.email!, subject, html });
  }

  // ── First look: new artists with a gap and no news yet, once ───────────────
  if (logReadable) {
    const newest = new Date(now - FIRST_LOOK_MIN_DAYS * DAY_MS).toISOString();
    const oldest = new Date(now - FIRST_LOOK_MAX_DAYS * DAY_MS).toISOString();
    const { data: fresh, error: freshErr } = await admin
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("role", "artist")
      .eq("is_minor", false)
      .not("email", "is", null)
      .not("email_verified_at", "is", null)
      .gte("created_at", oldest)
      .lte("created_at", newest);
    if (freshErr) results.errors.push(`new artists: ${freshErr.message}`);

    const newcomers = ((fresh ?? []) as ProfileRow[]).filter(
      (p) => p.profile_view_emails !== false && !weekly.some(([id]) => id === p.id),
    );
    if (newcomers.length > 0) {
      const newIds = newcomers.map((p) => p.id);
      // Already had a first look, or one of the old day-2 / day-7 nudges.
      const [seenFirst, seenNudge] = await Promise.all([
        admin.from("profile_email_sends").select("profile_id").eq("kind", "first_look").in("profile_id", newIds),
        admin.from("activation_nudges").select("profile_id").in("profile_id", newIds),
      ]);
      const skip = new Set<string>([
        ...((seenFirst.data ?? []) as Array<{ profile_id: string }>).map((r) => r.profile_id),
        ...((seenNudge.data ?? []) as Array<{ profile_id: string }>).map((r) => r.profile_id),
      ]);
      const pool = newcomers.filter((p) => !skip.has(p.id));
      const newWorks = await loadWorks(admin, pool.map((p) => p.id));

      for (const p of pool) {
        const progress = computeVerifiedProgress(p, newWorks.get(p.id)?.count ?? 0);
        if (progress.verified) continue;
        const snapshot = toSnapshot(p, newWorks.get(p.id));
        const { subject, html } = buildFirstLookEmail({
          name: p.full_name,
          username: p.username,
          unsubscribeToken: p.digest_unsubscribe_token,
          comparison: {
            now: snapshot,
            after: afterSnapshot(snapshot, exampleData?.snapshot ?? null),
            missing: progress.missing,
            exampleUrl: exampleData?.url ?? null,
          },
        });
        kindByKey.set(p.id, "first_look");
        outgoing.push({ key: p.id, to: p.email!, subject, html });
      }
    }
  }

  results.eligible = outgoing.length;
  if (outgoing.length === 0) return NextResponse.json(results);

  const failed = new Set(await sendResultEmails(outgoing));
  results.failed = failed.size;
  results.sent = outgoing.length - failed.size;
  results.withComparison = outgoing.filter((o) => !failed.has(o.key) && kindByKey.get(o.key) === "weekly_comparison").length;
  results.firstLook = outgoing.filter((o) => !failed.has(o.key) && kindByKey.get(o.key) === "first_look").length;

  // Remember what went out, so the comparison stops after a few weeks and the
  // first look never repeats.
  const logRows = outgoing
    .filter((o) => !failed.has(o.key) && kindByKey.has(o.key))
    .map((o) => ({ profile_id: o.key, kind: kindByKey.get(o.key)! }));
  if (logRows.length > 0) {
    const { error } = await admin.from("profile_email_sends").insert(logRows);
    if (error) results.errors.push(`log: ${error.message}`);
  }

  return NextResponse.json(results);
}
