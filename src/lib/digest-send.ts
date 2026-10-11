import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDigestHtml,
  buildPartnerDigestHtml,
  digestSubject,
  partnerDigestSubject,
  selectDigestOpportunities,
  type DigestData,
  type PartnerListingStat,
} from "@/lib/digest";
import type { Opportunity } from "@/types/database";

/**
 * Who receives the digest, what they have already been shown, and the send
 * itself.
 *
 * Server only — everything here uses the service role. `digest.ts` stays
 * responsible for choosing and rendering listings; this file is responsible
 * for addressing them.
 *
 * Recipients come from two places since migration 185. Profiles own anyone
 * with an account, via `weekly_digest`. The `subscribers` table holds only
 * addresses belonging to nobody, captured from the home page form. They used
 * to overlap, and drifted.
 */

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/** Below this, an issue is not worth the send. Better a quiet week than a
 *  thin one that teaches people the email is filler. */
export const DIGEST_MIN = 3;

/** How far back repeat suppression looks. Long enough that nothing recurs
 *  within a season, short enough that a listing open for a year can resurface
 *  once rather than never. */
export const SUPPRESSION_DAYS = 60;

/**
 * Resend's free plan allows 100 emails a day, shared with welcome, verification
 * and notification mail. A digest run stops at this many so transactional mail
 * always has room; recipients past it are reported as `deferred` and are not
 * recorded as sent, so a manual re-run of the same half picks them up.
 */
export const DIGEST_DAILY_BUDGET = 70;

/** cron-a / cron-b are the two halves of the artist list (Tue / Wed);
 *  cron-partner is the organisations' digest. "cron" is the pre-split single send. */
export type DigestTrigger = "cron" | "cron-a" | "cron-b" | "cron-partner" | "manual" | "welcome";

export type DigestHalf = "a" | "b";

/** Stable split of the list: FNV-1a over the lowercased address, by parity.
 *  The same address always lands in the same half, so nobody is mailed twice
 *  in a week or skipped. */
export function digestHalf(email: string): DigestHalf {
  let h = 0x811c9dc5;
  for (const ch of email.trim().toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2 === 0 ? "a" : "b";
}

/** Addresses we know can't be delivered to. One of these in a batch makes
 *  Resend reject all 100 (future-to-do #26), so they never reach it. */
export function isDeliverableAddress(email: string): boolean {
  if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) return false;
  const domain = email.split("@")[1].toLowerCase();
  return !(
    domain === "example.com" || domain === "example.org" || domain === "example.net" ||
    domain === "test.com" || domain === "localhost" ||
    domain.endsWith(".invalid") || domain.endsWith(".test") || domain.endsWith(".example")
  );
}

export interface DigestRecipient {
  email: string;
  /** Null for a subscriber with no account. */
  profileId: string | null;
  /** Identifies them to /unsubscribe without a session. */
  unsubscribeToken: string | null;
  /** Null for a subscriber with no account. Partners get their own digest. */
  role: string | null;
}

export interface DigestSendResult {
  sent: number;
  /** Had fewer than DIGEST_MIN listings left after suppression. */
  skipped: number;
  errors: number;
  /** Over the daily budget: not sent, not recorded, picked up by a re-run. */
  deferred?: number;
  /** Set when a Supabase read failed outright — distinguishes "nothing to
   *  send" from "couldn't find out what to send". */
  queryError?: string;
}

// ── Recipients ───────────────────────────────────────────────────────────────

export async function getDigestRecipients(): Promise<DigestRecipient[]> {
  const admin = createAdminClient();

  const [
    { data: profiles, error: profilesError },
    { data: subscribers, error: subscribersError },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, role, digest_unsubscribe_token")
      .eq("weekly_digest", true)
      .not("email", "is", null)
      // Unproved addresses are unvalidated addresses (190). A typo that
      // bounces costs the sender reputation every other recipient relies
      // on, so an account joins the list only once it has confirmed.
      .not("email_verified_at", "is", null),
    admin.from("subscribers").select("email, unsubscribe_token"),
  ]);

  if (profilesError) throw new Error(`digest: profiles query failed — ${profilesError.message}`);
  if (subscribersError) throw new Error(`digest: subscribers query failed — ${subscribersError.message}`);

  const byEmail = new Map<string, DigestRecipient>();

  for (const p of (profiles ?? []) as Array<{
    id: string;
    email: string;
    role: string | null;
    digest_unsubscribe_token: string | null;
  }>) {
    const email = p.email.trim().toLowerCase();
    if (!email || !isDeliverableAddress(email)) continue;
    byEmail.set(email, {
      email,
      profileId: p.id,
      unsubscribeToken: p.digest_unsubscribe_token,
      role: p.role,
    });
  }

  // 185 deletes the duplicates, but a stale row would otherwise mail someone
  // twice. The account version wins because only it can be unsubscribed from
  // the settings toggle.
  for (const s of (subscribers ?? []) as Array<{
    email: string;
    unsubscribe_token: string | null;
  }>) {
    const email = s.email.trim().toLowerCase();
    if (!email || !isDeliverableAddress(email) || byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      profileId: null,
      unsubscribeToken: s.unsubscribe_token,
      role: null,
    });
  }

  return [...byEmail.values()];
}

/** Count only, for the admin screen. */
export async function getDigestRecipientCount(): Promise<number> {
  return (await getDigestRecipients()).length;
}

// ── Pool and suppression ─────────────────────────────────────────────────────

/** Minimum days from now a deadline must be for us to include it in a digest.
 *  Recipients need time to actually act — same-day and next-day deadlines
 *  arrive too late to be useful. */
export const DIGEST_MIN_LEAD_DAYS = 2;

/** Every live listing, unranked. Curation happens in selectDigestOpportunities. */
export async function getDigestPool(): Promise<Opportunity[]> {
  const admin = createAdminClient();
  const minDate = new Date(Date.now() + DIGEST_MIN_LEAD_DAYS * 864e5)
    .toISOString()
    .split("T")[0];

  const { data, error } = await admin
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.is.null,deadline.gte.${minDate}`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) throw new Error(`digest: opportunities query failed — ${error.message}`);

  return (data ?? []) as Opportunity[];
}

/** Listing ids already sent to each address inside the suppression window. */
export async function getRecentlySent(): Promise<Map<string, Set<string>>> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - SUPPRESSION_DAYS * 864e5).toISOString();

  const { data, error } = await admin
    .from("digest_items")
    .select("email, opportunity_id")
    .gte("created_at", cutoff);

  if (error) throw new Error(`digest: digest_items query failed — ${error.message}`);

  const map = new Map<string, Set<string>>();
  for (const row of (data ?? []) as Array<{ email: string; opportunity_id: string }>) {
    const key = row.email.trim().toLowerCase();
    const set = map.get(key) ?? new Set<string>();
    set.add(row.opportunity_id);
    map.set(key, set);
  }
  return map;
}

// ── Recording ────────────────────────────────────────────────────────────────

interface SentRecord {
  email: string;
  profileId: string | null;
  opportunityIds: string[];
}

/**
 * Writes the send log. Failure here must not look like a failed send: the mail
 * has already gone out, so the worst case is a listing repeating once.
 */
export async function recordDigestSend(
  records: SentRecord[],
  trigger: DigestTrigger
): Promise<void> {
  if (records.length === 0) return;

  try {
    const admin = createAdminClient();
    const distinct = new Set(records.flatMap((r) => r.opportunityIds));

    const { data: send } = await admin
      .from("digest_sends")
      .insert({
        trigger,
        recipient_count: records.length,
        opportunity_count: distinct.size,
      })
      .select("id")
      .single();

    const sendId = (send as { id: string } | null)?.id;
    if (!sendId) return;

    const rows = records.flatMap((r) =>
      r.opportunityIds.map((id) => ({
        send_id: sendId,
        email: r.email,
        profile_id: r.profileId,
        opportunity_id: id,
      }))
    );

    for (let i = 0; i < rows.length; i += 500) {
      await admin.from("digest_items").insert(rows.slice(i, i + 500));
    }
  } catch (err) {
    console.error("digest: failed to record send", err);
  }
}

/** The most recent run, for the admin screen and for "new since last digest". */
export async function getLastDigestSend(): Promise<{
  sent_at: string;
  recipient_count: number;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("digest_sends")
    .select("sent_at, recipient_count")
    .in("trigger", ["cron", "cron-a", "cron-b", "manual"])
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { sent_at: string; recipient_count: number } | null) ?? null;
}

// ── The send ─────────────────────────────────────────────────────────────────

interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
}

const SINGLE_SEND_DELAY_MS = 600; // Resend allows ~2 requests a second

/**
 * Sends in batches of 100. If Resend rejects a batch (one bad address sinks
 * the lot), that chunk is retried one by one so a single failure costs one
 * email, not a hundred. Returns, per input, whether it went out.
 */
async function deliver(resend: Resend, mails: OutgoingMail[], tag: string): Promise<{ ok: boolean[]; firstError?: string }> {
  const ok: boolean[] = new Array(mails.length).fill(false);
  let firstError: string | undefined;

  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    const { error } = await resend.batch.send(
      chunk.map((m) => ({ from: FROM, to: m.to, subject: m.subject, html: m.html, tags: [{ name: "type", value: tag }] }))
    );

    if (!error) {
      for (let j = 0; j < chunk.length; j++) ok[i + j] = true;
      continue;
    }

    console.error("digest: resend.batch.send failed, retrying one by one —", error);
    firstError ??= error.message ?? JSON.stringify(error);
    for (let j = 0; j < chunk.length; j++) {
      const m = chunk[j];
      const { error: singleError } = await resend.emails.send({
        from: FROM, to: m.to, subject: m.subject, html: m.html, tags: [{ name: "type", value: tag }],
      });
      if (singleError) {
        console.error(`digest: single send to ${m.to} failed —`, singleError);
        firstError ??= singleError.message ?? JSON.stringify(singleError);
      } else {
        ok[i + j] = true;
      }
      await new Promise((r) => setTimeout(r, SINGLE_SEND_DELAY_MS));
    }
  }
  return { ok, firstError };
}

/**
 * Builds and sends one issue.
 *
 * Every recipient gets their own selection, because every recipient has seen
 * a different set before. That is not personalisation by taste — the ranking
 * is identical for everyone — it only stops the same listings recurring week
 * after week, which deadline-first ordering otherwise guarantees.
 */
export async function sendWeeklyDigest(
  trigger: Exclude<DigestTrigger, "welcome" | "cron-partner">,
  opts: { half?: DigestHalf } = {}
): Promise<DigestSendResult> {
  const empty: DigestSendResult = { sent: 0, skipped: 0, errors: 0 };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ...empty, queryError: "RESEND_API_KEY not set at send time" };

  let allRecipients: DigestRecipient[], pool: Opportunity[], alreadySent: Map<string, Set<string>>;
  try {
    [allRecipients, pool, alreadySent] = await Promise.all([
      getDigestRecipients(),
      getDigestPool(),
      getRecentlySent(),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("digest: aborting send —", message);
    return { ...empty, queryError: message };
  }

  // Organisations get their own digest (sendPartnerDigest); the artist list is
  // everyone else, optionally just one half of it.
  const recipients = allRecipients.filter(
    (r) => r.role !== "partner" && (!opts.half || digestHalf(r.email) === opts.half)
  );

  console.log(
    `digest[${trigger}${opts.half ? ":" + opts.half : ""}]: recipients=${recipients.length} pool=${pool.length} suppressionRows=${alreadySent.size}`
  );

  if (recipients.length === 0 || pool.length === 0) {
    return {
      ...empty,
      queryError: `recipients=${recipients.length} pool=${pool.length} — both queries succeeded but returned no rows`,
    };
  }

  const generatedAt = new Date().toISOString();

  const planned: Array<{
    recipient: DigestRecipient;
    picks: Opportunity[];
  }> = [];

  let skipped = 0;

  for (const recipient of recipients) {
    const seen = alreadySent.get(recipient.email);
    const fresh = seen ? pool.filter((o) => !seen.has(o.id)) : pool;
    const picks = selectDigestOpportunities(fresh);

    if (picks.length < DIGEST_MIN) {
      skipped++;
      continue;
    }
    planned.push({ recipient, picks });
  }

  if (planned.length === 0) return { ...empty, skipped };

  // Stay inside the daily cap; the rest wait for a re-run.
  const toSend = planned.slice(0, DIGEST_DAILY_BUDGET);
  const deferred = planned.length - toSend.length;

  const mails: OutgoingMail[] = toSend.map(({ recipient, picks }) => {
    const data: DigestData = { opportunities: picks, generatedAt };
    return {
      to: recipient.email,
      subject: digestSubject(picks.length),
      html: buildDigestHtml(data, SITE_URL, recipient.unsubscribeToken ?? undefined),
    };
  });

  // Tag lets the Resend webhook tell digest opens/clicks from every other email.
  const { ok, firstError } = await deliver(new Resend(apiKey), mails, "digest");

  const recorded: SentRecord[] = [];
  toSend.forEach(({ recipient, picks }, i) => {
    if (!ok[i]) return;
    recorded.push({
      email: recipient.email,
      profileId: recipient.profileId,
      opportunityIds: picks.map((o) => o.id),
    });
  });

  await recordDigestSend(recorded, trigger);

  const sent = recorded.length;
  const errors = toSend.length - sent;
  return {
    sent,
    skipped,
    errors,
    deferred,
    ...(sent === 0 && errors > 0 ? { queryError: `Resend rejected every email — ${firstError}` } : {}),
  };
}

/**
 * The organisations' digest: the same picks, framed for passing on to their
 * students or members, plus how their own listings are doing.
 *
 * Views are lifetime totals (opportunities.view_count is cumulative and counts
 * signed-in views only); clicks are the last seven days from analytics_events.
 */
export async function sendPartnerDigest(
  trigger: Extract<DigestTrigger, "cron-partner" | "manual">
): Promise<DigestSendResult> {
  const empty: DigestSendResult = { sent: 0, skipped: 0, errors: 0 };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ...empty, queryError: "RESEND_API_KEY not set at send time" };

  let allRecipients: DigestRecipient[], pool: Opportunity[], alreadySent: Map<string, Set<string>>;
  try {
    [allRecipients, pool, alreadySent] = await Promise.all([
      getDigestRecipients(),
      getDigestPool(),
      getRecentlySent(),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("partner digest: aborting send —", message);
    return { ...empty, queryError: message };
  }

  const recipients = allRecipients.filter((r) => r.role === "partner" && r.profileId);
  if (recipients.length === 0 || pool.length === 0) {
    return { ...empty, queryError: `partners=${recipients.length} pool=${pool.length} — nothing to send` };
  }

  // Each partner's published listings and their recent apply clicks, in two
  // queries for the whole list.
  const admin = createAdminClient();
  const profileIds = recipients.map((r) => r.profileId as string);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const { data: listingRows } = await admin
    .from("opportunities")
    .select("id, slug, title, view_count, profile_id")
    .in("profile_id", profileIds)
    .eq("is_active", true)
    .eq("status", "published");

  const listings = (listingRows ?? []) as Array<{
    id: string; slug: string | null; title: string; view_count: number | null; profile_id: string;
  }>;

  const clicksBy = new Map<string, number>();
  if (listings.length > 0) {
    const { data: clickRows } = await admin
      .from("analytics_events")
      .select("payload")
      .in("event_type", ["opportunity_click", "opportunity_apply_click"])
      .in("payload->>opportunity_id", listings.map((l) => l.id))
      .gte("created_at", weekAgo)
      .limit(5000);
    for (const row of (clickRows ?? []) as Array<{ payload: { opportunity_id?: string } | null }>) {
      const id = row.payload?.opportunity_id;
      if (id) clicksBy.set(id, (clicksBy.get(id) ?? 0) + 1);
    }
  }

  const generatedAt = new Date().toISOString();
  const planned: Array<{ recipient: DigestRecipient; picks: Opportunity[]; stats: PartnerListingStat[] }> = [];
  let skipped = 0;

  for (const recipient of recipients) {
    const seen = alreadySent.get(recipient.email);
    const fresh = seen ? pool.filter((o) => !seen.has(o.id)) : pool;
    const picks = selectDigestOpportunities(fresh);
    if (picks.length < DIGEST_MIN) {
      skipped++;
      continue;
    }
    const stats: PartnerListingStat[] = listings
      .filter((l) => l.profile_id === recipient.profileId)
      .map((l) => ({
        title: l.title,
        url: `${SITE_URL}/opportunities/${l.slug ?? l.id}?ref=partner_digest`,
        views: l.view_count ?? 0,
        clicks7d: clicksBy.get(l.id) ?? 0,
      }));
    planned.push({ recipient, picks, stats });
  }

  if (planned.length === 0) return { ...empty, skipped };

  const toSend = planned.slice(0, DIGEST_DAILY_BUDGET);
  const deferred = planned.length - toSend.length;

  const mails: OutgoingMail[] = toSend.map(({ recipient, picks, stats }) => ({
    to: recipient.email,
    subject: partnerDigestSubject(picks.length),
    html: buildPartnerDigestHtml({ opportunities: picks, generatedAt, stats }, SITE_URL, recipient.unsubscribeToken ?? undefined),
  }));

  // A different tag keeps partner opens and clicks out of the artist digest's numbers.
  const { ok, firstError } = await deliver(new Resend(apiKey), mails, "partner_digest");

  const recorded: SentRecord[] = [];
  toSend.forEach(({ recipient, picks }, i) => {
    if (!ok[i]) return;
    recorded.push({ email: recipient.email, profileId: recipient.profileId, opportunityIds: picks.map((o) => o.id) });
  });
  await recordDigestSend(recorded, trigger);

  const sent = recorded.length;
  const errors = toSend.length - sent;
  return {
    sent,
    skipped,
    errors,
    deferred,
    ...(sent === 0 && errors > 0 ? { queryError: `Resend rejected every email — ${firstError}` } : {}),
  };
}

/**
 * Sends the current issue to one address on sign-up.
 *
 * Logged like any other send, so the first real digest does not open with the
 * same listings this one just showed them.
 */
export async function sendWelcomeDigest(email: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const address = email.trim().toLowerCase();
  const pool = await getDigestPool();
  const picks = selectDigestOpportunities(pool);
  if (picks.length < DIGEST_MIN) return;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, digest_unsubscribe_token")
    .eq("email", address)
    .maybeSingle();

  const p = profile as { id: string; digest_unsubscribe_token: string | null } | null;

  let token = p?.digest_unsubscribe_token ?? null;
  if (!token) {
    const { data: sub } = await admin
      .from("subscribers")
      .select("unsubscribe_token")
      .eq("email", address)
      .maybeSingle();
    token = (sub as { unsubscribe_token?: string } | null)?.unsubscribe_token ?? null;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: FROM,
    to: address,
    subject: digestSubject(picks.length),
    html: buildDigestHtml(
      { opportunities: picks, generatedAt: new Date().toISOString() },
      SITE_URL,
      token ?? undefined
    ),
    tags: [{ name: "type", value: "digest" }],
  });

  await recordDigestSend(
    [{ email: address, profileId: p?.id ?? null, opportunityIds: picks.map((o) => o.id) }],
    "welcome"
  );
}

/** Recipients per send, for the admin screen: the two artist halves and the organisations. */
export async function getDigestSplitCounts(): Promise<{ a: number; b: number; partner: number }> {
  const all = await getDigestRecipients();
  let a = 0, b = 0, partner = 0;
  for (const r of all) {
    if (r.role === "partner") partner++;
    else if (digestHalf(r.email) === "a") a++;
    else b++;
  }
  return { a, b, partner };
}
