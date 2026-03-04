import axios from "axios";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
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

export async function fetchPageContent(url: string): Promise<{ text: string; ogImage: string | null }> {
  const response = await http.get(url, { responseType: "text" });
  const $ = cheerio.load(response.data as string);

  // og:image — most reliable image for the opportunity
  const ogImage =
    $('meta[property="og:image"]').attr("content") ??
    $('meta[name="twitter:image"]').attr("content") ??
    null;

  // Strip noise
  $("script, style, nav, footer, header, aside, [role='navigation'], [role='banner'], .cookie-banner, .ad, .advertisement").remove();

  // Extract meaningful text
  const text = $("main, article, .content, .main, #main, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return { text: text.slice(0, 10000), ogImage };
}

export async function fetchRssFeed(url: string): Promise<RssItem[]> {
  const feed = await rssParser.parseURL(url);
  return (feed.items ?? []).slice(0, 30).map((item) => ({
    title: item.title ?? "",
    content: item.contentSnippet ?? item.content ?? item.summary ?? "",
    link: item.link ?? "",
    pubDate: item.pubDate ?? "",
  }));
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
