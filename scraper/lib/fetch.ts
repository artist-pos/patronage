import axios from "axios";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { chromium, type Browser } from "playwright";
import type { RssItem } from "../types.js";

const rssParser = new Parser();

const http = axios.create({
  timeout: 20000,
  headers: {
    "User-Agent": "Patronage-Scraper/1.0 (patronage.nz; arts opportunities aggregator)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
  },
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

// ── Static HTML fetch (axios + cheerio) ─────────────────────────────────────

export async function fetchPageContent(url: string): Promise<{ text: string; ogImage: string | null; links: string[] }> {
  const response = await http.get(url, { responseType: "text" });
  const rawHtml = response.data as string;
  const $ = cheerio.load(rawHtml);
  const links = extractLinksFromHtml(rawHtml, url);

  const ogImage =
    $('meta[property="og:image"]').attr("content") ??
    $('meta[name="twitter:image"]').attr("content") ??
    null;

  $("script, style, nav, footer, header, aside, [role='navigation'], [role='banner'], .cookie-banner, .ad, .advertisement").remove();

  const text = $("main, article, .content, .main, #main, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return { text: text.slice(0, 10000), ogImage, links };
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

export async function fetchWithBrowser(url: string): Promise<{ text: string; ogImage: string | null; links: string[] }> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    const ogImage = await page
      .$eval('meta[property="og:image"], meta[name="twitter:image"]', (el) =>
        el.getAttribute("content")
      )
      .catch(() => null);

    const rawHtml = await page.content();
    const links = extractLinksFromHtml(rawHtml, url);

    await page.evaluate(() => {
      document
        .querySelectorAll(
          "script, style, nav, footer, header, aside, [role='navigation'], [role='banner'], .cookie-banner, .ad, .advertisement"
        )
        .forEach((el) => el.remove());
    });

    const text = await page.evaluate(() => {
      const el = document.querySelector("main, article, .content, .main, #main, body");
      return el ? (el.textContent ?? "").replace(/\s+/g, " ").trim() : "";
    });

    return { text: text.slice(0, 10000), ogImage, links };
  } finally {
    await page.close();
  }
}

// ── RSS fetch ────────────────────────────────────────────────────────────────

function sanitizeXml(xml: string): string {
  // Fix bare & not part of a valid entity reference (common in govt/CMS feeds)
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, "&amp;");
}

export async function fetchRssFeed(url: string): Promise<RssItem[]> {
  const response = await http.get(url, { responseType: "text" });
  const sanitized = sanitizeXml(response.data as string);
  const feed = await rssParser.parseString(sanitized);
  return (feed.items ?? []).slice(0, 30).map((item) => ({
    title: item.title ?? "",
    content: item.contentSnippet ?? item.content ?? item.summary ?? "",
    link: item.link ?? "",
    pubDate: item.pubDate ?? "",
  }));
}

// ── Org image resolution ─────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Tries to find a logo/image for an opportunity when the page had no og:image.
 * 1. Clearbit Logo API — high quality, works for well-known orgs
 * 2. Google Favicon — guaranteed fallback, always returns something
 */
export async function resolveOrgImage(
  opportunityUrl: string | null,
  sourceUrl: string
): Promise<string | null> {
  const domain = extractDomain(opportunityUrl ?? sourceUrl);
  if (!domain) return null;

  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  try {
    const res = await http.get(clearbitUrl, { timeout: 5000, responseType: "arraybuffer" });
    if (res.status === 200) return clearbitUrl;
  } catch {
    // not found — fall through
  }

  // Favicon is always available but small; still better than nothing
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

// ── Utility ──────────────────────────────────────────────────────────────────

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
