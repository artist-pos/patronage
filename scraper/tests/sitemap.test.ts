import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSitemapXml, filterByLastmodAge, resolveSitemapUrl } from "../lib/sitemap.js";

test("parseSitemapXml extracts loc + lastmod from a urlset", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.org/opportunities/grant-a/</loc><lastmod>2026-07-01</lastmod></url>
  <url><loc>https://example.org/opportunities/prize-b/</loc></url>
</urlset>`;
    const { childSitemaps, entries } = parseSitemapXml(xml);
    assert.equal(childSitemaps.length, 0);
    assert.deepEqual(entries, [
        { loc: "https://example.org/opportunities/grant-a/", lastmod: "2026-07-01" },
        { loc: "https://example.org/opportunities/prize-b/", lastmod: null },
    ]);
});

test("parseSitemapXml returns child sitemaps for an index", () => {
    const xml = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.org/sitemap-posts.xml</loc></sitemap>
  <sitemap><loc>https://example.org/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`;
    const { childSitemaps, entries } = parseSitemapXml(xml);
    assert.deepEqual(childSitemaps, [
        "https://example.org/sitemap-posts.xml",
        "https://example.org/sitemap-pages.xml",
    ]);
    assert.equal(entries.length, 0);
});

test("parseSitemapXml skips utility paths and binary files", () => {
    const xml = `<urlset>
  <url><loc>https://example.org/opportunities/open-call/</loc></url>
  <url><loc>https://example.org/tag/painting/</loc></url>
  <url><loc>https://example.org/brochure.pdf</loc></url>
  <url><loc>https://example.org/contact/</loc></url>
</urlset>`;
    const { entries } = parseSitemapXml(xml);
    assert.deepEqual(entries.map((e) => e.loc), ["https://example.org/opportunities/open-call/"]);
});

test("filterByLastmodAge drops stale entries, keeps undated ones", () => {
    const now = Date.parse("2026-07-19T00:00:00Z");
    const entries = [
        { loc: "https://x/fresh", lastmod: "2026-07-01" },
        { loc: "https://x/stale", lastmod: "2021-03-15" },
        { loc: "https://x/undated", lastmod: null },
        { loc: "https://x/garbage", lastmod: "not-a-date" },
    ];
    const kept = filterByLastmodAge(entries, 90, now).map((e) => e.loc);
    assert.deepEqual(kept, ["https://x/fresh", "https://x/undated", "https://x/garbage"]);
});

test("resolveSitemapUrl handles paths and absolute URLs", () => {
    assert.equal(resolveSitemapUrl("/sitemap.xml", "https://example.org/opps/"), "https://example.org/sitemap.xml");
    assert.equal(resolveSitemapUrl("sitemap.xml", "https://example.org/opps/"), "https://example.org/sitemap.xml");
    assert.equal(resolveSitemapUrl("https://cdn.example.org/sm.xml", "https://example.org/"), "https://cdn.example.org/sm.xml");
});
