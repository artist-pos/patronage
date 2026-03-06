import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/types/database";

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/**
 * Send the current digest to a single email address (e.g. on artist sign-up).
 * Fire-and-forget — call with .catch(console.error).
 */
export async function sendWelcomeDigest(email: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const data = await getDigestData();
  if (data.newOpps.length === 0 && data.closingSoon.length === 0) return;

  const resend = new Resend(key);
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to Patronage — your first opportunities digest",
    html: buildDigestHtml(data, SITE_URL, email),
  });
}

export interface DigestData {
  newOpps: Opportunity[];
  closingSoon: Opportunity[];
  generatedAt: string;
}

export async function getDigestData(): Promise<DigestData> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekAgo = new Date(today.getTime() - 7 * 864e5).toISOString().split("T")[0];
  const weekAhead = new Date(today.getTime() + 7 * 864e5).toISOString().split("T")[0];

  const [{ data: newData }, { data: closingData }] = await Promise.all([
    // New: added in the last 7 days, still active
    supabase
      .from("opportunities")
      .select("*")
      .eq("is_active", true)
      .gte("created_at", weekAgo)
      .or(`deadline.is.null,deadline.gte.${todayStr}`)
      .order("created_at", { ascending: false }),

    // Closing soon: deadline within the next 7 days
    supabase
      .from("opportunities")
      .select("*")
      .eq("is_active", true)
      .gte("deadline", todayStr)
      .lte("deadline", weekAhead)
      .order("deadline", { ascending: true }),
  ]);

  return {
    newOpps: (newData ?? []) as Opportunity[],
    closingSoon: (closingData ?? []) as Opportunity[],
    generatedAt: today.toISOString(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(d: string | null): string {
  if (!d) return "Open deadline";
  return new Date(d + "T00:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtFunding(o: Opportunity): string | null {
  if (o.funding_range?.trim()) return o.funding_range.trim();
  if (o.funding_amount != null) {
    return o.funding_amount >= 1000
      ? `$${(o.funding_amount / 1000).toFixed(0)}k`
      : `$${o.funding_amount}`;
  }
  return null;
}

function countryPriority(country: string): number {
  if (country === "NZ") return 0;
  if (country === "AUS") return 1;
  return 2;
}

function sortByDeadline(a: Opportunity, b: Opportunity): number {
  if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return 0;
}

function formatCountryList(countries: string[]): string {
  const labels: Record<string, string> = {
    NZ: "New Zealand",
    AUS: "Australia",
    Global: "global programmes",
    UK: "the United Kingdom",
    US: "the United States",
    EU: "Europe",
  };
  const formatted = [...new Set(countries)].map((c) => labels[c] ?? c);
  if (formatted.length === 0) return "";
  if (formatted.length === 1) return formatted[0];
  return `${formatted.slice(0, -1).join(", ")} and ${formatted[formatted.length - 1]}`;
}

function formatHighlights(titles: string[]): string {
  const escaped = titles.map(esc);
  if (escaped.length === 1) return `the ${escaped[0]}`;
  if (escaped.length === 2) return `the ${escaped[0]} and the ${escaped[1]}`;
  return `the ${escaped.slice(0, -1).join(", the ")}, and the ${escaped[escaped.length - 1]}`;
}

// ── Opportunity row ───────────────────────────────────────────────────────────

function isUrgent(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date().toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0];
  return deadline >= today && deadline <= weekAhead;
}

function oppRow(o: Opportunity, siteUrl: string): string {
  const funding = fmtFunding(o);
  const link = `${siteUrl}/opportunities/${o.id}`;
  const urgent = isUrgent(o.deadline);
  const deadlineLabel = urgent
    ? `${fmtDate(o.deadline)} ⚠ Closing soon`
    : fmtDate(o.deadline);
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;">
        <strong style="font-size:15px;">${esc(o.title)}</strong><br>
        <span style="color:#888;font-size:13px;">${esc(o.organiser)} &middot; ${esc(o.type)} &middot; ${esc(o.country)}</span><br>
        <span style="color:#888;font-size:13px;">Deadline: ${deadlineLabel}</span>
        ${funding ? `<br><span style="color:#888;font-size:13px;">Funding: ${esc(funding)}</span>` : ""}
        <br>
        <a href="${link}" style="color:#000;font-size:13px;text-decoration:underline;">View opportunity &rarr;</a>
      </td>
    </tr>`;
}

function sectionHeader(label: string): string {
  return `
    <tr>
      <td style="padding:28px 0 8px;">
        <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#888;margin:0;border-top:2px solid #000;padding-top:12px;">${label}</p>
      </td>
    </tr>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildDigestHtml(data: DigestData, siteUrl: string, subscriberEmail?: string): string {
  const { newOpps, closingSoon } = data;

  const unsubscribeUrl = subscriberEmail
    ? `${siteUrl}/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`
    : `${siteUrl}/unsubscribe`;

  // ── Section computation ────────────────────────────────────────────────────

  // Sort newOpps: NZ first, then AUS, then funding desc, then deadline asc
  const prioritised = [...newOpps].sort((a, b) => {
    const cp = countryPriority(a.country) - countryPriority(b.country);
    if (cp !== 0) return cp;
    const fa = a.funding_amount ?? 0;
    const fb = b.funding_amount ?? 0;
    if (fa !== fb) return fb - fa;
    return sortByDeadline(a, b);
  });

  // Featured: top 3 from prioritised list
  const featured = prioritised.slice(0, 3);
  const usedIds = new Set(featured.map((o) => o.id));

  // NZ & AUS: remaining, NZ or AUS only, sorted by deadline, up to 8
  const nzAus = prioritised
    .filter((o) => !usedIds.has(o.id) && (o.country === "NZ" || o.country === "AUS"))
    .sort(sortByDeadline)
    .slice(0, 8);
  nzAus.forEach((o) => usedIds.add(o.id));

  // Global: remaining non-NZ/AUS, sorted by deadline, up to 6
  const global = prioritised
    .filter((o) => !usedIds.has(o.id) && o.country !== "NZ" && o.country !== "AUS")
    .sort(sortByDeadline)
    .slice(0, 6);
  global.forEach((o) => usedIds.add(o.id));

  // Closing this week: closingSoon, up to 8
  const closing = closingSoon.slice(0, 8);

  // Are there opportunities not shown?
  const allShownIds = new Set([...featured, ...nzAus, ...global].map((o) => o.id));
  const hasMore = newOpps.some((o) => !allShownIds.has(o.id));

  // ── Editorial summary ──────────────────────────────────────────────────────

  const totalNew = newOpps.length;
  const countries = newOpps.map((o) => o.country);
  const countryList = formatCountryList(countries);
  const highlightTitles = featured.slice(0, 3).map((o) => o.title);

  let summary = `This week on Patronage: ${totalNew} new ${totalNew === 1 ? "opportunity" : "opportunities"}`;
  if (countryList) summary += ` across ${countryList}`;
  summary += ".";
  if (highlightTitles.length > 0) {
    summary += ` Highlights include ${formatHighlights(highlightTitles)}.`;
  }
  if (closing.length > 0) {
    summary += ` ${closing.length} ${closing.length === 1 ? "opportunity closes" : "opportunities close"} this week.`;
  }

  // ── HTML ───────────────────────────────────────────────────────────────────

  const rows = (opps: Opportunity[]) =>
    opps.map((o) => oppRow(o, siteUrl)).join("");

  const section = (label: string, opps: Opportunity[]) =>
    opps.length === 0 ? "" : `
      ${sectionHeader(label)}
      ${rows(opps)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#fff;color:#000;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr><td>

      <!-- Header -->
      <h1 style="font-size:20px;font-weight:600;margin:0 0 2px;">Patronage</h1>
      <p style="color:#888;font-size:13px;margin:0 0 28px;">Weekly opportunities digest</p>

      <!-- Editorial summary -->
      <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 32px;padding:16px;background:#f9f9f9;border-left:3px solid #000;">
        ${esc(summary)}
      </p>

      <!-- Sections -->
      <table width="100%" cellpadding="0" cellspacing="0">
        ${section("Featured this week", featured)}
        ${section("New in New Zealand &amp; Australia", nzAus)}
        ${section("Global opportunities", global)}
        ${section("Closing this week", closing)}
      </table>

      <!-- View all -->
      ${hasMore ? `
      <p style="margin:24px 0 0;font-size:13px;">
        <a href="${siteUrl}/opportunities" style="color:#000;text-decoration:underline;">View all opportunities &rarr;</a>
      </p>` : ""}

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px;border-top:1px solid #e5e5e5;padding-top:20px;">
        <tr>
          <td>
            <p style="margin:0 0 8px;font-size:13px;">
              <a href="${siteUrl}/partners" style="color:#000;text-decoration:underline;">Submit an opportunity &rarr;</a>
            </p>
            <p style="color:#888;font-size:12px;margin:0;">
              You&apos;re receiving this because you subscribed at
              <a href="${siteUrl}" style="color:#888;">${siteUrl}</a>.
              &nbsp;&middot;&nbsp;
              <a href="${unsubscribeUrl}" style="color:#888;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}
