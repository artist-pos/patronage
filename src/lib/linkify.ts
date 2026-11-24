/**
 * Turns links in plain text into links, the way X does: a pasted URL (with or
 * without https://), a bare domain like patronage.nz/studio, or a site path like
 * /partners/here-together/space all become clickable, and are shown shortened.
 *
 * Pure and framework-free so the same rules serve React (studio updates),
 * email HTML (digest note) and the server that picks which link gets a card.
 */

export type LinkSegment =
  | { type: "text"; text: string }
  | {
      type: "link";
      /** The text as typed. */
      text: string;
      /** Absolute for outside links; a root-relative path for links into this site. */
      href: string;
      /** Shortened form shown to the reader: no protocol, no www, no long tail. */
      display: string;
      internal: boolean;
    };

// The configured site host (NEXT_PUBLIC_SITE_URL, which is localhost in dev) is
// added in isSiteHost. A bare "localhost" is deliberately not here: pasted in
// production it isn't ours, so it must be treated as an outside link.
const SITE_HOSTS = new Set(["patronage.nz", "www.patronage.nz"]);

// Common TLDs only, so "e.g." or "file.pdf" aren't mistaken for domains.
const TLDS = "nz|com|org|net|au|io|co|uk|us|art|gallery|studio|info|me|ca|eu|design|photography|space|xyz|app|dev";

const LINK_RE = new RegExp(
  [
    // https://… or http://…
    "https?:\\/\\/[^\\s<>]+",
    // bare domain, optionally with a path; not part of an email address or a longer word
    `(?<![@\\w./-])(?:www\\.)?(?:[a-z0-9-]+\\.)+(?:${TLDS})\\b(?:\\/[^\\s<>]*)?`,
    // a path into this site: needs two or more segments, so "and/or" and "24/7" are left alone
    "(?<![\\w/:.#?=&-])\\/[a-z0-9][a-z0-9_-]*(?:\\/[a-z0-9._~%-]+)+(?:[?#][^\\s<>]*)?",
  ].join("|"),
  "gi",
);

function trimTrailing(raw: string): string {
  let s = raw.replace(/[.,;:!?'"”’]+$/, "");
  // A closing bracket belongs to the link only if it has an opener inside it.
  while (s.endsWith(")") && (s.match(/\)/g)?.length ?? 0) > (s.match(/\(/g)?.length ?? 0)) {
    s = s.slice(0, -1).replace(/[.,;:!?'"”’]+$/, "");
  }
  return s;
}

function siteHost(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return null;
  }
}

function isSiteHost(host: string): boolean {
  const h = host.toLowerCase();
  return SITE_HOSTS.has(h) || h === siteHost();
}

function shorten(display: string, max = 32): string {
  return display.length > max ? `${display.slice(0, max - 1)}…` : display;
}

function toSegment(raw: string): LinkSegment {
  // Site path typed on its own.
  if (raw.startsWith("/")) {
    return { type: "link", text: raw, href: raw, display: shorten(raw.replace(/\/$/, "")), internal: true };
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { type: "text", text: raw };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { type: "text", text: raw };

  const display = shorten(
    `${url.host.replace(/^www\./i, "")}${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`.replace(/\/$/, ""),
  );

  // A full link to this site becomes a root-relative one, so it stays on whatever
  // origin the reader is on (production, preview, local).
  if (isSiteHost(url.host)) {
    const path = `${url.pathname}${url.search}${url.hash}`;
    return { type: "link", text: raw, href: path || "/", display, internal: true };
  }
  return { type: "link", text: raw, href: url.toString(), display, internal: false };
}

export function linkify(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0;
    const raw = trimTrailing(m[0]);
    if (!raw) continue;
    if (start > last) segments.push({ type: "text", text: text.slice(last, start) });
    const seg = toSegment(raw);
    segments.push(seg);
    // Anything trimmed off the end ("…link.") goes back to the text after it.
    last = start + raw.length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

/** The first link in the text, used to pick which one earns a preview card. */
export function firstLink(text: string): Extract<LinkSegment, { type: "link" }> | null {
  for (const s of linkify(text)) if (s.type === "link") return s;
  return null;
}

/** Absolute URL for a link, given the site's origin. */
export function absoluteHref(link: Extract<LinkSegment, { type: "link" }>, siteUrl: string): string {
  return link.internal ? `${siteUrl.replace(/\/$/, "")}${link.href}` : link.href;
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Email-safe HTML for plain text: everything escaped, links made clickable,
 * line breaks kept. No other markup gets through.
 */
export function linkifyToHtml(text: string, opts: { siteUrl: string; linkStyle?: string }): string {
  const style = opts.linkStyle ?? "color:#005a56;text-decoration:underline;";
  return linkify(text)
    .map((s) =>
      s.type === "text"
        ? escHtml(s.text).replace(/\n/g, "<br>")
        : `<a href="${escHtml(absoluteHref(s, opts.siteUrl))}" style="${style}">${escHtml(s.display)}</a>`,
    )
    .join("");
}
