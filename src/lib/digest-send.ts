import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDigestHtml,
  digestSubject,
  selectDigestOpportunities,
  type DigestData,
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

export type DigestTrigger = "cron" | "manual" | "welcome";

export interface DigestRecipient {
  email: string;
  /** Null for a subscriber with no account. */
  profileId: string | null;
  /** Identifies them to /unsubscribe without a session. */
  unsubscribeToken: string | null;
}

export interface DigestSendResult {
  sent: number;
  /** Had fewer than DIGEST_MIN listings left after suppression. */
  skipped: number;
  errors: number;
}

// ── Recipients ───────────────────────────────────────────────────────────────

export async function getDigestRecipients(): Promise<DigestRecipient[]> {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: subscribers }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, digest_unsubscribe_token")
      .eq("weekly_digest", true)
      .not("email", "is", null),
    admin.from("subscribers").select("email, unsubscribe_token"),
  ]);

  const byEmail = new Map<string, DigestRecipient>();

  for (const p of (profiles ?? []) as Array<{
    id: string;
    email: string;
    digest_unsubscribe_token: string | null;
  }>) {
    const email = p.email.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      email,
      profileId: p.id,
      unsubscribeToken: p.digest_unsubscribe_token,
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
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      profileId: null,
      unsubscribeToken: s.unsubscribe_token,
    });
  }

  return [...byEmail.values()];
}

/** Count only, for the admin screen. */
export async function getDigestRecipientCount(): Promise<number> {
  return (await getDigestRecipients()).length;
}

// ── Pool and suppression ─────────────────────────────────────────────────────

/** Every live listing, unranked. Curation happens in selectDigestOpportunities. */
export async function getDigestPool(): Promise<Opportunity[]> {
  const admin = createAdminClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const { data } = await admin
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.is.null,deadline.gte.${todayStr}`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(200);

  return (data ?? []) as Opportunity[];
}

/** Listing ids already sent to each address inside the suppression window. */
export async function getRecentlySent(): Promise<Map<string, Set<string>>> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - SUPPRESSION_DAYS * 864e5).toISOString();

  const { data } = await admin
    .from("digest_items")
    .select("email, opportunity_id")
    .gte("created_at", cutoff);

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
    .in("trigger", ["cron", "manual"])
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { sent_at: string; recipient_count: number } | null) ?? null;
}

// ── The send ─────────────────────────────────────────────────────────────────

/**
 * Builds and sends one issue.
 *
 * Every recipient gets their own selection, because every recipient has seen
 * a different set before. That is not personalisation by taste — the ranking
 * is identical for everyone — it only stops the same listings recurring week
 * after week, which deadline-first ordering otherwise guarantees.
 */
export async function sendWeeklyDigest(
  trigger: Exclude<DigestTrigger, "welcome">
): Promise<DigestSendResult> {
  const empty: DigestSendResult = { sent: 0, skipped: 0, errors: 0 };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return empty;

  const [recipients, pool, alreadySent] = await Promise.all([
    getDigestRecipients(),
    getDigestPool(),
    getRecentlySent(),
  ]);

  if (recipients.length === 0 || pool.length === 0) return empty;

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

  const resend = new Resend(apiKey);
  let sent = 0;
  let errors = 0;
  const recorded: SentRecord[] = [];

  for (let i = 0; i < planned.length; i += 100) {
    const chunk = planned.slice(i, i + 100);

    const batch = chunk.map(({ recipient, picks }) => {
      const data: DigestData = { opportunities: picks, generatedAt };
      return {
        from: FROM,
        to: recipient.email,
        subject: digestSubject(picks.length),
        html: buildDigestHtml(data, SITE_URL, recipient.unsubscribeToken ?? undefined),
        // Lets the Resend webhook tell digest opens/clicks from every other email.
        tags: [{ name: "type", value: "digest" }],
      };
    });

    const { error } = await resend.batch.send(batch);

    if (error) {
      errors += chunk.length;
      continue;
    }

    sent += chunk.length;
    for (const { recipient, picks } of chunk) {
      recorded.push({
        email: recipient.email,
        profileId: recipient.profileId,
        opportunityIds: picks.map((o) => o.id),
      });
    }
  }

  await recordDigestSend(recorded, trigger);

  return { sent, skipped, errors };
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
