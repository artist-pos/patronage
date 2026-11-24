import dns from "node:dns/promises";
import net from "node:net";
import { absoluteHref, firstLink } from "@/lib/linkify";

/**
 * Link cards for studio updates (migration 230). The server fetches the first
 * link in an update once, when it is posted or edited, and stores the result.
 * Viewing a page never triggers a fetch.
 *
 * This fetches URLs that strangers type, so it is deliberately careful:
 * public hosts only (private, loopback and link-local addresses are refused,
 * including after a redirect), http(s) only, short timeout, small body, HTML
 * only. Links into this site are fetched from our own origin and never follow
 * a redirect, so a page that bounces to sign-in yields no card.
 */

export interface LinkPreview {
  /** Absolute for outside links; root-relative for links into this site. */
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  site: string | null;
}

const TIMEOUT_MS = 4000;
const MAX_BYTES = 400_000;
const MAX_REDIRECTS = 3;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb")) return true;
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  return true;
}

async function assertPublicHost(host: string): Promise<void> {
  const bare = host.replace(/^\[|\]$/g, "");
  if (net.isIP(bare)) {
    if (isPrivateIp(bare)) throw new Error("private address");
    return;
  }
  if (bare === "localhost" || bare.endsWith(".localhost") || bare.endsWith(".internal") || bare.endsWith(".local")) {
    throw new Error("private host");
  }
  const addrs = await dns.lookup(bare, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new Error("private address");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function fetchHtml(start: URL, trusted: boolean): Promise<{ html: string; finalUrl: URL } | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") return null;
    if (!trusted) await assertPublicHost(current.hostname);

    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "PatronageLinkPreview/1.0", accept: "text/html,application/xhtml+xml" },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || trusted) return null;
      current = new URL(loc, current);
      continue;
    }
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").toLowerCase().includes("html")) return null;
    return { html: await readCapped(res), finalUrl: current };
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function readMeta(html: string): { get: (...keys: string[]) => string | null; title: string | null } {
  const head = html.slice(0, 200_000);
  const map = new Map<string, string>();
  for (const tag of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const m of tag[0].matchAll(/([a-z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
    }
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content !== undefined && !map.has(key)) map.set(key, decodeEntities(attrs.content));
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return {
    get: (...keys) => {
      for (const k of keys) {
        const v = map.get(k);
        if (v) return v;
      }
      return null;
    },
    title: titleTag ? decodeEntities(titleTag[1]) || null : null,
  };
}

function clip(s: string | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function safeImage(raw: string | null, base: URL): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The preview for the first link found in any of the given texts, or null. Never throws. */
export async function getLinkPreviewForText(...texts: Array<string | null | undefined>): Promise<LinkPreview | null> {
  const link = firstLink(texts.filter(Boolean).join("\n"));
  if (!link) return null;

  try {
    const target = new URL(absoluteHref(link, SITE_URL));
    const fetched = await fetchHtml(target, link.internal);
    if (!fetched) return null;

    const meta = readMeta(fetched.html);
    const title = clip(meta.get("og:title", "twitter:title") ?? meta.title, 120);
    if (!title) return null;

    return {
      url: link.href,
      title,
      description: clip(meta.get("og:description", "twitter:description", "description"), 200),
      image: safeImage(meta.get("og:image", "twitter:image"), fetched.finalUrl),
      site: clip(meta.get("og:site_name") ?? fetched.finalUrl.hostname.replace(/^www\./, ""), 60),
    };
  } catch (err) {
    console.error("link-preview: failed —", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Reads a stored preview back out of the database. The column is writable by
 * the artist, so treat it as untrusted: required fields, and only http(s) or
 * root-relative URLs.
 */
export function parseStoredPreview(raw: unknown): LinkPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const okUrl = (v: string | null) => !!v && (/^https?:\/\//i.test(v) || (v.startsWith("/") && !v.startsWith("//")));

  const url = str(r.url, 2000);
  const title = str(r.title, 160);
  if (!url || !title || !okUrl(url)) return null;
  const image = str(r.image, 2000);
  return {
    url,
    title,
    description: str(r.description, 240),
    image: image && /^https?:\/\//i.test(image) ? image : null,
    site: str(r.site, 80),
  };
}
