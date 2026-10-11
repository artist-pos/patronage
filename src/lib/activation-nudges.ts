import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDigestPool } from "@/lib/digest-send";
import { opportunityUrl } from "@/lib/digest";
import { selectInstantMatches } from "@/lib/opportunity-match";
import { computeVerifiedProgress, VERIFIED_WORKS_REQUIRED } from "@/lib/verified-progress";
import type { DisciplineEnum, Opportunity } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";

/**
 * Resend's free plan allows 100 emails a day, shared with the digest, welcome
 * and verification mail. Nudges stay well inside that: a nudge that misses the
 * budget is not recorded, so the next day's run picks it up.
 */
export const NUDGE_DAILY_BUDGET = 15;

type Kind = "day2" | "day7";

/** Age windows, in whole days since signup. Two days wide so one missed cron
 *  run doesn't lose a cohort. */
const WINDOWS: Record<Kind, { minDays: number; maxDays: number }> = {
  day2: { minDays: 2, maxDays: 4 },
  day7: { minDays: 7, maxDays: 9 },
};

export interface NudgeResult {
  dryRun: boolean;
  considered: number;
  sent: number;
  deferred: number;
  errors: string[];
  /** Dry runs only: who would be emailed and what is missing. */
  preview: { email: string; kind: Kind; missing: string[]; matches: number }[];
}

interface Candidate {
  id: string;
  email: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  disciplines: DisciplineEnum[] | null;
  country: string | null;
  digest_unsubscribe_token: string | null;
  created_at: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstName(full: string | null): string | null {
  const first = full?.trim().split(/\s+/)[0];
  return first || null;
}

function fmtDeadline(d: string | null): string {
  if (!d) return "Open call";
  return `Closes ${new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "long" })}`;
}

function buildNudgeEmail(
  c: Candidate,
  kind: Kind,
  missing: string[],
  matches: Opportunity[],
): { subject: string; html: string } {
  const name = firstName(c.full_name);
  const subject =
    kind === "day2"
      ? "Finish your Patronage profile"
      : "A few things left to get Verified on Patronage";

  const intro =
    kind === "day2"
      ? "Welcome again. A complete profile is what curators, organisers and supporters see first."
      : "A week in. Verified artists can sell work and accept support, and they show up more clearly in the directory.";

  const todo = missing.length
    ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;">To get Verified, add:</p>
       <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;">
         ${missing.map((m) => `<li>${esc(m)}</li>`).join("")}
       </ul>`
    : "";

  const matchBlock = matches.length
    ? `<p style="margin:24px 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#888;">Open in your disciplines</p>
       ${matches
         .map(
           (o) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.4;">
             <a href="${opportunityUrl(o, SITE_URL, "activation")}" style="color:#000;font-weight:600;">${esc(o.title)}</a><br>
             <span style="color:#888;font-size:13px;">${esc(o.organiser)} · ${esc(fmtDeadline(o.deadline))}</span>
           </p>`,
         )
         .join("")}`
    : "";

  const unsubscribe = c.digest_unsubscribe_token
    ? `${SITE_URL}/unsubscribe?token=${c.digest_unsubscribe_token}`
    : `${SITE_URL}/unsubscribe`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF9;color:#000;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 24px;">
    <table width="552" cellpadding="0" cellspacing="0" role="presentation" style="max-width:552px;width:100%;">
      <tr><td>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">${name ? `Hi ${esc(name)},` : "Hi,"}</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">${esc(intro)}</p>
        ${todo}
        <p style="margin:0 0 8px;"><a href="${SITE_URL}/studio/profile" style="display:inline-block;background:#000;color:#fff;padding:12px 22px;font-size:14px;font-weight:500;text-decoration:none;border-radius:8px;">Open my profile</a></p>
        ${matchBlock}
        <p style="margin:32px 0 0;font-size:12px;line-height:1.5;color:#888;">
          You're getting this because you joined Patronage.
          <a href="${unsubscribe}" style="color:#888;">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html };
}

export async function runActivationNudges(opts: { dryRun?: boolean } = {}): Promise<NudgeResult> {
  const dryRun = !!opts.dryRun;
  const admin = createAdminClient();
  const result: NudgeResult = { dryRun, considered: 0, sent: 0, deferred: 0, errors: [], preview: [] };

  const now = Date.now();
  const earliest = new Date(now - WINDOWS.day7.maxDays * 864e5).toISOString();
  const latest = new Date(now - WINDOWS.day2.minDays * 864e5).toISOString();

  // Everyone signed up between 2 and 9 days ago who could plausibly be nudged.
  // Verified email + digest opt-in mirrors who the weekly digest goes to.
  const { data: rows, error } = await admin
    .from("profiles")
    .select("id, email, full_name, bio, avatar_url, disciplines, country, digest_unsubscribe_token, created_at")
    .eq("role", "artist")
    .eq("weekly_digest", true)
    .eq("is_minor", false)
    .not("email", "is", null)
    .not("email_verified_at", "is", null)
    .gte("created_at", earliest)
    .lte("created_at", latest);

  if (error) {
    result.errors.push(`profiles query: ${error.message}`);
    return result;
  }
  const candidates = (rows ?? []) as Candidate[];
  if (candidates.length === 0) return result;
  const ids = candidates.map((c) => c.id);

  const [{ data: sentRows, error: sentError }, { data: workRows }] = await Promise.all([
    admin.from("activation_nudges").select("profile_id, kind").in("profile_id", ids),
    admin.from("artworks").select("profile_id").in("profile_id", ids),
  ]);

  // Without the log we cannot tell who has been nudged, and would re-send daily.
  if (sentError) {
    result.errors.push(`activation_nudges read failed (migration 205 run?): ${sentError.message}`);
    return result;
  }

  const alreadySent = new Set((sentRows ?? []).map((r) => `${r.profile_id}:${r.kind}`));
  const worksBy = new Map<string, number>();
  for (const w of workRows ?? []) worksBy.set(w.profile_id, (worksBy.get(w.profile_id) ?? 0) + 1);

  const due: { c: Candidate; kind: Kind; missing: string[] }[] = [];
  for (const c of candidates) {
    const ageDays = (now - new Date(c.created_at).getTime()) / 864e5;
    const kind: Kind | null =
      ageDays >= WINDOWS.day7.minDays && ageDays < WINDOWS.day7.maxDays
        ? "day7"
        : ageDays >= WINDOWS.day2.minDays && ageDays < WINDOWS.day2.maxDays
          ? "day2"
          : null;
    if (!kind || alreadySent.has(`${c.id}:${kind}`)) continue;

    const progress = computeVerifiedProgress(c, worksBy.get(c.id) ?? 0);
    if (progress.verified) continue;
    due.push({ c, kind, missing: progress.missing });
  }
  result.considered = due.length;
  if (due.length === 0) return result;

  const pool = await getDigestPool();
  const resend = dryRun ? null : new Resend(process.env.RESEND_API_KEY);

  for (const { c, kind, missing } of due) {
    const matches = selectInstantMatches(pool, { disciplines: c.disciplines, country: c.country }, 3);

    if (dryRun) {
      result.preview.push({ email: c.email, kind, missing, matches: matches.length });
      continue;
    }
    if (result.sent >= NUDGE_DAILY_BUDGET) {
      result.deferred++;
      continue;
    }

    const { subject, html } = buildNudgeEmail(c, kind, missing, matches);
    // Single sends, not a batch: one undeliverable address must not sink the rest.
    const { error: sendError } = await resend!.emails.send({
      from: FROM,
      to: c.email,
      subject,
      html,
      tags: [{ name: "type", value: "activation" }],
    });
    if (sendError) {
      result.errors.push(`${kind} → ${c.id}: ${sendError.message}`);
      continue;
    }
    const { error: logError } = await admin.from("activation_nudges").insert({ profile_id: c.id, kind });
    if (logError) result.errors.push(`log ${kind} → ${c.id}: ${logError.message}`);
    result.sent++;
  }

  return result;
}

// Re-exported so the cron's docs and the admin UI can state the rule.
export { VERIFIED_WORKS_REQUIRED };
