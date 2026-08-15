/**
 * Tag an outbound URL so the destination's analytics can attribute the visit
 * to Patronage.
 *
 * Rules:
 *  - Only http/https URLs are touched. mailto:, tel:, and anything unparseable
 *    are returned exactly as given.
 *  - Existing query params and the hash fragment are preserved.
 *  - If the URL already carries a utm_source, it is left alone — some listings
 *    are published with the organiser's own tracking already attached, and
 *    overwriting it would break their attribution.
 */
export function withUtm(
  url: string,
  { campaign, content }: { campaign: string; content?: string }
): string {
  if (!url) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // relative or malformed — leave it be
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
  if (parsed.searchParams.has("utm_source")) return url;

  parsed.searchParams.set("utm_source", "patronage");
  parsed.searchParams.set("utm_medium", "referral");
  parsed.searchParams.set("utm_campaign", campaign);
  if (content) parsed.searchParams.set("utm_content", content);

  return parsed.toString();
}
