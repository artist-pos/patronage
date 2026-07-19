import axios from "axios";
import * as cheerio from "cheerio";
import { REALISTIC_HEADERS } from "./auth.js";

const http = axios.create({ timeout: 20000, headers: REALISTIC_HEADERS });

export interface SitemapEntry {
    loc: string;
    lastmod: string | null;
}

const SKIP_PATH = /\/(login|logout|admin|search|tag|tags|category|categories|wp-|feed|rss|contact|about|privacy|terms|cookie|newsletter|subscribe|donate|shop|cart)\b/i;
const SKIP_EXT = /\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|mp3|docx?)(\?.*)?$/i;

async function fetchXml(url: string): Promise<string> {
    const res = await http.get(url, { responseType: "text" });
    return res.data as string;
}

/**
 * Parse one sitemap document. Returns either the child sitemap URLs (for an
 * index) or the leaf URL entries. Pure — no fetching — so it's unit-testable.
 */
export function parseSitemapXml(xml: string): { childSitemaps: string[]; entries: SitemapEntry[] } {
    const $ = cheerio.load(xml, { xmlMode: true });

    const childSitemaps = $("sitemap loc")
        .toArray()
        .map((el) => $(el).text().trim())
        .filter(Boolean);
    if (childSitemaps.length > 0) return { childSitemaps, entries: [] };

    const entries: SitemapEntry[] = [];
    $("url").each((_, el) => {
        const loc = $("loc", el).first().text().trim();
        const lastmod = $("lastmod", el).first().text().trim() || null;
        if (!loc) return;
        if (SKIP_PATH.test(loc) || SKIP_EXT.test(loc)) return;
        entries.push({ loc, lastmod });
    });
    return { childSitemaps: [], entries };
}

/**
 * Filter sitemap entries to those whose <lastmod> falls within the last
 * `maxAgeDays`. Entries with no lastmod are kept (we can't age them out).
 */
export function filterByLastmodAge(entries: SitemapEntry[], maxAgeDays: number, now = Date.now()): SitemapEntry[] {
    const cutoff = now - maxAgeDays * 86_400_000;
    return entries.filter((e) => {
        if (!e.lastmod) return true;
        const t = Date.parse(e.lastmod);
        return Number.isNaN(t) ? true : t >= cutoff;
    });
}

async function parseSitemap(url: string, depth = 0): Promise<SitemapEntry[]> {
    if (depth > 3) return []; // guard against deeply nested indexes
    let xml: string;
    try {
        xml = await fetchXml(url);
    } catch {
        return [];
    }

    const { childSitemaps, entries } = parseSitemapXml(xml);
    for (const childUrl of childSitemaps) {
        entries.push(...await parseSitemap(childUrl, depth + 1));
    }
    return entries;
}

/**
 * Fetch and parse a sitemap (or sitemap index), returning all leaf URL entries.
 * Handles recursive sitemap indexes up to 3 levels deep.
 */
export async function fetchSitemap(sitemapUrl: string): Promise<SitemapEntry[]> {
    return parseSitemap(sitemapUrl);
}

/**
 * Resolve a sitemap URL that may be a path ("/sitemap.xml") or absolute URL.
 */
export function resolveSitemapUrl(sitemapUrl: string, sourceUrl: string): string {
    if (sitemapUrl.startsWith("http")) return sitemapUrl;
    const base = new URL(sourceUrl);
    return `${base.origin}${sitemapUrl.startsWith("/") ? "" : "/"}${sitemapUrl}`;
}
