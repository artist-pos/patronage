import axios from "axios";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { chromium, type Browser, type BrowserContext } from "playwright";
import type { RssItem } from "../types.js";
import { trimHtml } from "./trim.js";
import {
    REALISTIC_HEADERS,
    RSS_HEADERS,
    needsRealisticHeaders,
    needsCookieAuth,
    loadCookiesWithAutoLogin,
} from "./auth.js";

const rssParser = new Parser();

// ── HTTP client with realistic headers ──────────────────────────────────────
// This alone fixes most government 403s. The old "Patronage-Scraper/1.0"
// user-agent was being blocked by every site that checks UA strings.

const http = axios.create({
    timeout: 20000,
    headers: REALISTIC_HEADERS,
});

// ── Link extraction from raw HTML ────────────────────────────────────────────

const SKIP_PATH = /\/(login|logout|admin|search|tag|tags|category|categories|page\/\d|wp-|feed|rss|sitemap|contact|about|privacy|terms|cookie|newsletter|subscribe|donate|shop|cart|event|news|blog|press|media)\b/i;
const SKIP_EXT = /\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|mp3|docx?)$/i;

export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const base = new URL(baseUrl);
    const seen = new Set<string>();
    const links: string[] = [];

    $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return;
        try {
            const url = new URL(href, baseUrl);
            if (url.hostname !== base.hostname) return;
            const path = url.pathname;
            if (path === "/" || path === base.pathname) return;
            if (SKIP_PATH.test(path) || SKIP_EXT.test(path)) return;
            const clean = url.origin + path;
            if (seen.has(clean)) return;
            seen.add(clean);
            links.push(clean);
        } catch { /* invalid URL */ }
    });

    return links;
}

// ── Outbound link picker (aggregator sources) ────────────────────────────────
// For detail pages on aggregator sites (ArtInfoLand, e-flux, etc.), pick the
// most likely outbound link to the actual opportunity provider.

export function pickOutboundLink(html: string, currentUrl: string): string | null {
    const $ = cheerio.load(html);
    const here = new URL(currentUrl);
    const candidates: { href: string; score: number }[] = [];

    $("a[href]").each((_, el) => {
        const raw = $(el).attr("href");
        if (!raw) return;
        let u: URL;
        try { u = new URL(raw, currentUrl); } catch { return; }
        if (u.hostname === here.hostname) return;
        if (/(facebook|twitter|x\.com|instagram|youtube|linkedin|tiktok)\./.test(u.hostname)) return;
        const text = ($(el).text() || "").trim().toLowerCase();
        let score = 0;
        if (/^https?:\/\//.test(raw)) score += 1;
        if (/apply|submit|enter|website|more info|learn more|details|official/.test(text)) score += 3;
        if ($(el).closest("p, .entry-content, article, main").length) score += 1;
        candidates.push({ href: u.toString(), score });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.href ?? null;
}

// ── Static HTML fetch (axios + cheerio) ─────────────────────────────────────

export interface FetchResult {
    text: string;
    ogImage: string | null;
    links: string[];
    etag: string | null;
    notModified: boolean;
}

export async function fetchPageContent(
    url: string,
    opts: { ifNoneMatch?: string | null; ifModifiedSince?: string | null } = {}
): Promise<FetchResult> {
    // Build headers — add cookies for authenticated sites
    const headers: Record<string, string> = { ...REALISTIC_HEADERS };
    const authSite = needsCookieAuth(url);
    if (authSite?.needsCookies) {
        const cookies = await loadCookiesWithAutoLogin(authSite.domain);
        if (cookies) {
            headers["Cookie"] = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
        }
    }
    if (opts.ifNoneMatch) headers["If-None-Match"] = opts.ifNoneMatch;
    if (opts.ifModifiedSince) headers["If-Modified-Since"] = opts.ifModifiedSince;

    let response;
    try {
        response = await http.get(url, { responseType: "text", headers, validateStatus: (s) => s < 400 || s === 304 });
    } catch (err: any) {
        // Some servers send 304 as an error — treat it gracefully
        if (err?.response?.status === 304) {
            return { text: "", ogImage: null, links: [], etag: err.response.headers["etag"] ?? null, notModified: true };
        }
        throw err;
    }

    if (response.status === 304) {
        return { text: "", ogImage: null, links: [], etag: response.headers["etag"] ?? null, notModified: true };
    }

    const rawHtml = response.data as string;
    const $ = cheerio.load(rawHtml);
    const links = extractLinksFromHtml(rawHtml, url);

    const ogImage =
        $('meta[property="og:image"]').attr("content") ??
        $('meta[name="twitter:image"]').attr("content") ??
        null;

    const text = trimHtml(rawHtml);
    const etag = (response.headers["etag"] as string | undefined) ?? null;

    return { text, ogImage, links, etag, notModified: false };
}

// ── Browser fetch (Playwright — for JS-rendered pages) ───────────────────────

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!_browser) {
        _browser = await chromium.launch({ headless: true });
    }
    return _browser;
}

export async function closeBrowser(): Promise<void> {
    if (_browser) {
        await _browser.close();
        _browser = null;
    }
}

async function buildContext(browser: Browser, url: string) {
    const context = await browser.newContext({
        userAgent: REALISTIC_HEADERS["User-Agent"],
        locale: "en-NZ",
        extraHTTPHeaders: { "Accept-Language": REALISTIC_HEADERS["Accept-Language"] },
    });
    const authSite = needsCookieAuth(url);
    if (authSite?.needsCookies) {
        const cookies = await loadCookiesWithAutoLogin(authSite.domain);
        if (cookies) {
            await context.addCookies(cookies.map((c) => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path || "/",
                expires: c.expires || -1,
                httpOnly: c.httpOnly || false,
                secure: c.secure || false,
                sameSite: (c.sameSite || "Lax") as "Strict" | "Lax" | "None",
            })));
        }
    }
    return context;
}

async function fetchPageWithContext(context: import("playwright").BrowserContext, url: string): Promise<{ text: string; ogImage: string | null; links: string[] }> {
    const page = await context.newPage();
    try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        const ogImage = await page
            .$eval('meta[property="og:image"], meta[name="twitter:image"]', (el) => el.getAttribute("content"))
            .catch(() => null);
        const rawHtml = await page.content();
        const links = extractLinksFromHtml(rawHtml, url);
        const text = trimHtml(rawHtml);
        return { text, ogImage, links };
    } finally {
        await page.close();
    }
}

export async function fetchWithBrowser(url: string): Promise<{ text: string; ogImage: string | null; links: string[] }> {
    const browser = await getBrowser();
    const context = await buildContext(browser, url);
    try {
        return await fetchPageWithContext(context, url);
    } finally {
        await context.close();
    }
}

/**
 * Fetch multiple pages with a single shared Playwright context (cheaper for paginated sources).
 * Caller is responsible for calling closePaginatedContext when done.
 */
export async function fetchPaginatedWithBrowser(urls: string[]): Promise<{ text: string; ogImage: string | null; links: string[] }[]> {
    if (urls.length === 0) return [];
    const browser = await getBrowser();
    const context = await buildContext(browser, urls[0]);
    const results: { text: string; ogImage: string | null; links: string[] }[] = [];
    try {
        for (const url of urls) {
            results.push(await fetchPageWithContext(context, url));
        }
    } finally {
        await context.close();
    }
    return results;
}

// ── RSS fetch ────────────────────────────────────────────────────────────────

function sanitizeXml(xml: string): string {
    return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, "&amp;");
}

export async function fetchRssFeed(url: string): Promise<RssItem[]> {
    const response = await http.get(url, {
        responseType: "text",
        headers: RSS_HEADERS,
    });
    const sanitized = sanitizeXml(response.data as string);
    const feed = await rssParser.parseString(sanitized);
    return (feed.items ?? []).slice(0, 30).map((item) => ({
        title: item.title ?? "",
        content: item.contentSnippet ?? item.content ?? item.summary ?? "",
        link: item.link ?? "",
        pubDate: item.pubDate ?? "",
    }));
}

// ── Utility ──────────────────────────────────────────────────────────────────

export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}