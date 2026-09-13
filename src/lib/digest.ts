import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/types/database";

/** How many listings a digest carries. Curated, not comprehensive — we would
 *  rather send four good ones than seven padded with filler. */
export const DIGEST_SIZE = 7;

// ── Palette ──────────────────────────────────────────────────────────────────
// Design-system tokens resolved to hex. Email clients have no CSS custom
// properties, so these are the oklch values from globals.css converted once
// here rather than eyeballed per template.
const INK = "#0a0a0a";        // --foreground
const MUTED = "#6c6c6c";      // --fg-muted
const SUBTLE = "#8f8f8f";     // --fg-subtle
const RULE = "#e1e1e1";       // --border
const BRAND = "#005a56";      // --brand (civic teal)
const BRAND_SUB = "#e7f5f4";  // --brand-sub
const URGENT = "#DC2626";     // --urgent
const PAPER = "#FAFAF9";      // --background

// Geist is a webfont the mail clients will not have. Name it first so Apple
// Mail and anything rendering in a browser picks it up, then fall back.
const SANS = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DigestData {
  /** The curated set, already ordered for the email. At most DIGEST_SIZE. */
  opportunities: Opportunity[];
  generatedAt: string;
}

// ── Selection ────────────────────────────────────────────────────────────────

/** Days until the deadline. Rolling/open deadlines sort last: they are never
 *  urgent, so they should not displace something that actually closes. */
function daysToDeadline(o: Opportunity): number {
  if (!o.deadline) return Number.MAX_SAFE_INTEGER;
  return Math.ceil(
    (new Date(o.deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000
  );
}

/** Best available read of an opportunity's monetary value, for ranking only. */
function valueOf(o: Opportunity): number {
  if (o.funding_amount != null) return o.funding_amount;
  // Fall back to the largest figure named in a range string ("$25,000 – $50,000").
  const figures = (o.funding_range ?? "").match(/\d[\d,]*/g);
  if (!figures) return 0;
  return Math.max(...figures.map((f) => Number(f.replace(/,/g, "")) || 0));
}

/** Geographic bucket for spread. City where we have one, country otherwise —
 *  seven Auckland grants are not "spread" just because they are all NZ. */
function geoKey(o: Opportunity): string {
  return (o.city?.trim() || o.country || "unknown").toLowerCase();
}

/** Discipline bucket for variety. Falls back to the opportunity type so that
 *  listings with no sub_categories still diversify against each other. */
function disciplineKey(o: Opportunity): string {
  const first = (o.sub_categories ?? []).find((d) => d?.trim());
  return (first || o.type || "unknown").toLowerCase();
}

/**
 * Picks up to `limit` opportunities.
 *
 * Priority is the order given in the brief: closing soonest, then highest
 * value, then geographic spread, then discipline variety. The first two are a
 * sort; the last two are a diversity filter layered on top, applied as
 * widening quotas. Pass one allows a single listing per city and per
 * discipline, pass two allows a second, and so on — so spread is honoured
 * while it can be, and urgency wins once it cannot.
 *
 * Never pads: if the pool holds four, four are returned.
 */
export function selectDigestOpportunities(
  pool: Opportunity[],
  limit: number = DIGEST_SIZE
): Opportunity[] {
  const ranked = [...pool].sort((a, b) => {
    const da = daysToDeadline(a);
    const db = daysToDeadline(b);
    if (da !== db) return da - db;               // closing soonest
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va !== vb) return vb - va;               // highest value
    return a.title.localeCompare(b.title);       // stable
  });

  const picked: Opportunity[] = [];
  const chosen = new Set<string>();
  const geoCount = new Map<string, number>();
  const discCount = new Map<string, number>();

  for (let quota = 1; picked.length < limit && quota <= limit; quota++) {
    for (const o of ranked) {
      if (picked.length >= limit) break;
      if (chosen.has(o.id)) continue;

      const g = geoKey(o);
      const d = disciplineKey(o);
      if ((geoCount.get(g) ?? 0) >= quota) continue;
      if ((discCount.get(d) ?? 0) >= quota) continue;

      picked.push(o);
      chosen.add(o.id);
      geoCount.set(g, (geoCount.get(g) ?? 0) + 1);
      discCount.set(d, (discCount.get(d) ?? 0) + 1);
    }
  }

  return picked;
}

/** The unsuppressed issue: what a brand new subscriber would receive today.
 *  Used by the admin preview. Real sends go through sendWeeklyDigest, which
 *  also skips what each recipient has already been shown. */
export async function getDigestData(): Promise<DigestData> {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Everything still open. Curation happens in selectDigestOpportunities —
  // the query's job is only to bound the pool to live, published listings.
  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.is.null,deadline.gte.${todayStr}`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(200);

  return {
    opportunities: selectDigestOpportunities((data ?? []) as Opportunity[]),
    generatedAt: today.toISOString(),
  };
}

/** Subject line. Counts down honestly when the pool is thin. */
export function digestSubject(count: number): string {
  if (count === 1) return "1 opportunity worth knowing about this week";
  return `${count} opportunities worth knowing about this week`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: string | null): string {
  if (!d) return "Rolling deadline";
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

function fmtLocation(o: Opportunity): string | null {
  if (o.country === "Global") return "Open to all";
  const city = o.city?.trim();
  if (city && o.country) return `${city}, ${o.country}`;
  return city || o.country || null;
}

/** Canonical public URL, slug-first to match the rest of the site. */
export function opportunityUrl(o: Opportunity, siteUrl: string, ref?: string): string {
  const base = `${siteUrl}/opportunities/${o.slug ?? o.id}`;
  return ref ? `${base}?ref=${ref}` : base;
}

/** Images come from our own compressor and are already absolute Supabase
 *  object URLs. Anything relative would break in a mail client, so drop it. */
function absoluteImage(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

/** mailto: for the "know someone for this?" hand-off. */
function forwardMailto(o: Opportunity, siteUrl: string): string {
  const url = opportunityUrl(o, siteUrl, "digest");
  const body = [
    "I thought this might be up your alley.",
    "",
    o.title,
    fmtDate(o.deadline),
    "",
    url,
    "",
    "via Patronage",
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(o.title)}&body=${encodeURIComponent(body)}`;
}

// ── Opportunity card ─────────────────────────────────────────────────────────

function metaLine(o: Opportunity): string {
  const parts = [fmtLocation(o), o.type, fmtFunding(o)].filter(Boolean) as string[];
  return parts.map(esc).join(" &middot; ");
}

function oppCard(o: Opportunity, siteUrl: string): string {
  const img = absoluteImage(o.featured_image_url);
  const view = opportunityUrl(o, siteUrl, "digest");
  const copy = `${view}&action=copy`;
  const days = daysToDeadline(o);
  const closing = days > 0 && days <= 7;

  const deadlineHtml = o.deadline
    ? `<span style="color:${closing ? URGENT : MUTED};font-weight:${closing ? 600 : 400};">Closes ${esc(fmtDate(o.deadline))}${closing ? ` &middot; ${days}d left` : ""}</span>`
    : `<span style="color:${MUTED};">Rolling deadline</span>`;

  // Hairline above every card. Without it a listing with no image runs into the
  // one above and the set reads as fewer items than it holds.
  return `
    <tr>
      <td style="padding:26px 0 32px;border-top:1px solid ${RULE};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          ${img ? `
          <tr>
            <td style="padding:0 0 14px;">
              <a href="${view}" style="text-decoration:none;display:block;">
                <img src="${esc(img)}" alt="" width="552" height="200" style="display:block;width:100%;max-width:552px;height:200px;object-fit:contain;border:0;outline:none;background:#f5f5f4;" />
              </a>
            </td>
          </tr>` : ""}
          <tr>
            <td style="padding:0 0 6px;">
              <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:${SUBTLE};">
                ${esc(o.organiser)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 8px;">
              <a href="${view}" style="color:${INK};text-decoration:none;">
                <span style="font-family:${SANS};font-size:20px;line-height:1.3;font-weight:600;color:${INK};">${esc(o.title)}</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 4px;">
              <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.5;color:${MUTED};">${metaLine(o)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 14px;">
              <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.5;">${deadlineHtml}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 12px;">
              <a href="${view}" style="font-family:${SANS};font-size:13px;font-weight:600;color:${BRAND};text-decoration:none;border-bottom:1px solid ${BRAND};padding-bottom:1px;">View opportunity &rarr;</a>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND_SUB};padding:10px 12px;">
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};">
                Know someone for this?
                &nbsp;<a href="${forwardMailto(o, siteUrl)}" style="color:${BRAND};text-decoration:underline;font-weight:600;">Email</a>
                &nbsp;&middot;&nbsp;<a href="${copy}" style="color:${BRAND};text-decoration:underline;font-weight:600;">Copy link</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildDigestHtml(
  data: DigestData,
  siteUrl: string,
  unsubscribeToken?: string
): string {
  const { opportunities } = data;

  const unsubscribeUrl = unsubscribeToken
    ? `${siteUrl}/unsubscribe?token=${unsubscribeToken}`
    : `${siteUrl}/unsubscribe`;

  const issueDate = new Date(data.generatedAt).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const cards = opportunities.map((o) => oppCard(o, siteUrl)).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(digestSubject(opportunities.length))}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};-webkit-font-smoothing:antialiased;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${esc(opportunities.map((o) => o.title).slice(0, 3).join(" · "))}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:40px 24px;">
        <table width="552" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:552px;width:100%;">

          <!-- Masthead -->
          <tr>
            <td style="padding:0 0 6px;">
              <a href="${siteUrl}?ref=digest" style="text-decoration:none;">
                <span style="font-family:${SANS};font-size:17px;font-weight:600;letter-spacing:-.01em;color:${INK};">Patronage</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px;border-bottom:1px solid ${INK};">
              <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${SUBTLE};">
                Weekly digest &nbsp;&middot;&nbsp; ${esc(issueDate)}
              </p>
            </td>
          </tr>

          <!-- Standfirst -->
          <tr>
            <td style="padding:26px 0 8px;">
              <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.6;color:${MUTED};">
                ${opportunities.length === 1
                  ? "one opportunity worth a look this week."
                  : `${opportunities.length} opportunities worth a look this week. picked for what is closing, what pays, and where they are.`}
              </p>
            </td>
          </tr>

          <!-- Cards -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                ${cards}
              </table>
            </td>
          </tr>

          <!-- Browse all -->
          <tr>
            <td style="padding:2px 0 0;border-top:1px solid ${RULE};">
              <p style="margin:18px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;">
                <a href="${siteUrl}/opportunities?ref=digest" style="color:${INK};text-decoration:underline;">Browse every open opportunity &rarr;</a>
              </p>
            </td>
          </tr>

          <!-- Forward prompt -->
          <tr>
            <td style="padding:32px 0 0;">
              <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.7;color:${MUTED};">
                Know someone who should see these?<br>
                <strong style="color:${INK};font-weight:600;">Forward the weekly digest</strong> to them.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:30px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-top:1px solid ${RULE};">
                <tr>
                  <td style="padding:18px 0 0;">
                    <p style="margin:0 0 10px;font-family:${SANS};font-size:13px;">
                      <a href="${siteUrl}/list-an-opportunity?ref=digest" style="color:${INK};text-decoration:underline;">List an opportunity &rarr;</a>
                    </p>
                    <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${SUBTLE};">
                      You are receiving this because you subscribed at
                      <a href="${siteUrl}" style="color:${SUBTLE};">patronage.nz</a>.
                      &nbsp;&middot;&nbsp;
                      <a href="${unsubscribeUrl}" style="color:${SUBTLE};">Unsubscribe</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
