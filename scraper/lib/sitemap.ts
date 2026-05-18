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

async function parseSitemap(url: string, depth = 0): Promise<SitemapEntry[]> {
    if (depth > 3) return []; // guard against deeply nested indexes
    let xml: string;
    try {
        xml = await fetchXml(url);
    } catch {
        return [];
    }

    const $ = cheerio.load(xml, { xmlMode: true });
    const entries: SitemapEntry[] = [];

    // Sitemap index — recurse into child sitemaps
    const childSitemaps = $("sitemap loc");
    if (childSitemaps.length > 0) {
        for (const el of childSitemaps.toArray()) {
            const childUrl = $(el).text().trim();
            if (!childUrl) continue;
            const children = await parseSitemap(childUrl, depth + 1);
            entries.push(...children);
        }
        return entries;
    }

    // Regular sitemap
    $("url").each((_, el) => {
        const loc = $("loc", el).first().text().trim();
        const lastmod = $("lastmod", el).first().text().trim() || null;
        if (!loc) return;
        if (SKIP_PATH.test(loc) || SKIP_EXT.test(loc)) return;
        entries.push({ loc, lastmod });
    });

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
