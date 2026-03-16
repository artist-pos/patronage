/**
 * Smart link filtering for the followLinks scraper path.
 *
 * Problems this solves:
 *   - Following nav/footer/utility links (/about, /contact, /sitemap…)
 *   - Following links to external social-media domains
 *   - Following file downloads (.pdf, .zip…)
 *   - Following links from hijacked/redirected domains
 *   - Exceeding maxLinks because of junk links before useful ones
 *
 * Usage:
 *   const toFollow = filterLinks(rawLinks, { baseUrl: source.url, maxLinks: 10 });
 */

// Paths that reliably indicate non-opportunity pages
const BLOCKLIST_PATH =
  /\/(login|logout|sign.?up|register|admin|search|tags?|categor(y|ies)|author|wp-[a-z]+|feed\/?$|rss\/?$|sitemap|contact|about|privacy|terms|cookie|newsletter|subscribe|unsubscribe|donate|shop|cart|basket|events?\/?$|news\/?$|press\/?$|media\/?$|blog\/?$|accessibility|cdn-cgi|email.?protection|language|lang\/|page\/\d+|archive\/?$|profile|account|dashboard)\b/i;

// URL patterns that strongly suggest an opportunity detail page
const ALLOWLIST_PATH =
  /\/(opportunit|grant|funding|prize|residenc|fellowship|open.?call|apply|application|submission|award|bursary|commission|scholarship|competition|call-for|callfor)\b/i;

// External domains that should never be followed
const SOCIAL_DOMAINS =
  /\b(facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|pinterest\.com|threads\.net|vimeo\.com|snapchat\.com|whatsapp\.com)\b/i;

// File extensions to skip (unless configured otherwise by source)
const SKIP_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|tar|gz|mp4|mp3|jpg|jpeg|png|gif|svg|webp|ico|woff2?)$/i;

export interface FilterLinksOptions {
  /** The source's base URL — used for same-domain enforcement. */
  baseUrl: string;
  /** If set, only follow links whose path or full URL matches this pattern. */
  linkPattern?: string | RegExp;
  /** Allow following links to external domains (default: false). */
  allowExternalDomains?: boolean;
  /** Maximum number of links to return (default: 10). */
  maxLinks?: number;
}

/**
 * Filters a raw list of absolute URLs down to candidate opportunity pages.
 * Returns at most `maxLinks` results.
 */
export function filterLinks(links: string[], options: FilterLinksOptions): string[] {
  const { baseUrl, linkPattern, allowExternalDomains = false, maxLinks = 10 } = options;

  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const customPattern =
    linkPattern instanceof RegExp
      ? linkPattern
      : linkPattern
        ? new RegExp(linkPattern, "i")
        : null;

  const filtered = links.filter((link) => {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      return false;
    }

    // Skip social media regardless of domain setting
    if (SOCIAL_DOMAINS.test(url.hostname)) return false;

    // Domain check
    if (!allowExternalDomains && url.hostname !== base.hostname) return false;

    const path = url.pathname;

    // Skip file downloads
    if (SKIP_EXT.test(path)) return false;

    // Skip blocklisted paths
    if (BLOCKLIST_PATH.test(path)) return false;

    // If the source specifies a link pattern, it's authoritative
    if (customPattern) return customPattern.test(path) || customPattern.test(link);

    // No custom pattern: use allowlist to prefer opportunity-like URLs.
    // We still return true for non-allowlisted paths (some sites use numeric/slug
    // URLs with no keywords) — but allowlisted paths sort first (see sort below).
    return true;
  });

  // Sort allowlist-matching links first so they fill the maxLinks cap
  filtered.sort((a, b) => {
    const aMatch = ALLOWLIST_PATH.test(new URL(a).pathname) ? 0 : 1;
    const bMatch = ALLOWLIST_PATH.test(new URL(b).pathname) ? 0 : 1;
    return aMatch - bMatch;
  });

  return filtered.slice(0, maxLinks);
}
