import "dotenv/config";
import { writeFileSync } from "fs";
import { sources } from "./sources/index.js";
import {
  fetchPageContent,
  fetchWithBrowser,
  fetchPaginatedWithBrowser,
  fetchRssFeed,
  pickOutboundLink,
  closeBrowser,
  sleep,
} from "./lib/fetch.js";
import { extractFromPage, extractFromRssItem } from "./lib/extract.js";
import { upsertOpportunity, loadDedupeCache, normalizeUrl, touchOpportunity, hashContent, type DedupeCache } from "./lib/upsert.js";
import { fetchSitemap, resolveSitemapUrl } from "./lib/sitemap.js";
import { fetchWpPosts } from "./lib/wp.js";
import { isAllowedByRobots } from "./lib/robots.js";
import { filterLinks } from "./lib/filter-links.js";
import type { Source, ScrapedOpportunity } from "./types.js";

const RATE_LIMIT_MS = 2_000;
const PAGINATION_RATE_LIMIT_MS = 1_000; // lighter delay between list pages vs detail pages
const SOURCE_TIMEOUT_MS = 360_000;      // 6 min — deep sources (40 pages) need more headroom

// ── Helpers ───────────────────────────────────────────────────────────────────

function applySourceMeta(opp: ScrapedOpportunity, source: Source): ScrapedOpportunity {
  const merged = [...new Set([...(opp.disciplines ?? []), ...(source.disciplines ?? [])])];
  return { ...opp, disciplines: merged };
}

/** Race a promise against a hard timeout. Throws on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${ms / 1000}s`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

/** Return the Nth quarter of an array (tierNum is 1-based). */
function getChunk<T>(arr: T[], tierNum: number, totalTiers = 4): T[] {
  const size = Math.ceil(arr.length / totalTiers);
  return arr.slice((tierNum - 1) * size, tierNum * size);
}

// ── Per-source processor ──────────────────────────────────────────────────────

interface SourceResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

async function processSource(source: Source, cache: DedupeCache): Promise<SourceResult> {
  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  async function upsert(opp: ScrapedOpportunity, image: string | null) {
    const result = await upsertOpportunity(opp, source.url, image, {
      disciplines: source.disciplines,
      is_recurring: source.is_recurring,
      recurrence_pattern: source.recurrence_pattern,
    }, cache);
    if (result === "inserted") inserted++;
    else if (result === "updated") updated++;
    else skipped++;
  }

  if (source.feedUrl) {
    // ── WordPress REST API ───────────────────────────────────────────────────
    const posts = await fetchWpPosts(source.url, { feedPath: source.feedUrl });
    console.log(`  ↳ ${posts.length} WP posts`);
    for (const post of posts) {
      const opps = await extractFromPage(post.content, post.link, source.country);
      for (const opp of opps) {
        if (!opp.url) opp.url = post.link;
        if (!opp.featured_image_url && post.featuredImageUrl) opp.featured_image_url = post.featuredImageUrl;
        const enriched = applySourceMeta(opp, source);
        await upsert(enriched, enriched.featured_image_url ?? null);
      }
    }
  } else if (source.isRss) {
    const items = await fetchRssFeed(source.url);
    console.log(`  ↳ ${items.length} RSS items`);
    for (const item of items) {
      const opps = await extractFromRssItem(item, source.url, source.country);
      for (const opp of opps) {
        if (!opp.url && item.link) opp.url = item.link;
        const enriched = applySourceMeta(opp, source);
        await upsert(enriched, enriched.featured_image_url ?? null);
      }
    }
  } else if (source.sitemapUrl) {
    // ── Sitemap-first discovery ──────────────────────────────────────────────
    const sitemapAbsUrl = resolveSitemapUrl(source.sitemapUrl, source.url);
    const entries = await fetchSitemap(sitemapAbsUrl);

    // Filter by linkPattern if provided, then apply dedup cache
    const filtered = entries.filter(({ loc }) => {
      if (source.linkPattern) {
        const pat = typeof source.linkPattern === "string" ? new RegExp(source.linkPattern) : source.linkPattern;
        if (!pat.test(loc)) return false;
      }
      return true;
    });

    const DETAIL_BUDGET = parseInt(process.env.SOURCE_DETAIL_BUDGET ?? "200", 10);

    // Partition into new vs known
    const toFetch: typeof filtered = [];
    let sitemapSkipped = 0;
    for (const entry of filtered) {
      const norm = normalizeUrl(entry.loc);
      const meta = cache.urls.get(norm);
      if (!meta) {
        toFetch.push(entry);
        continue;
      }
      // If lastmod-only and last_seen_at >= lastmod, skip without fetching
      if (source.sitemapLastmodOnly && entry.lastmod && meta.last_seen_at && meta.last_seen_at >= entry.lastmod) {
        sitemapSkipped++;
        skipped++;
        continue;
      }
      toFetch.push(entry);
    }

    const budgeted = toFetch.slice(0, DETAIL_BUDGET);
    console.log(`  ↳ ${filtered.length} sitemap URLs; ${budgeted.length} to fetch, ${sitemapSkipped} skipped by lastmod`);

    for (const entry of budgeted) {
      try {
        if (!await isAllowedByRobots(entry.loc)) {
          console.log(`    ⊘ robots.txt disallows ${entry.loc}`);
          skipped++;
          continue;
        }

        const norm = normalizeUrl(entry.loc);
        const meta = cache.urls.get(norm);

        const fetchResult = await fetchPageContent(entry.loc, {
          ifNoneMatch: meta?.etag ?? null,
          ifModifiedSince: meta?.last_seen_at ?? null,
        });

        if (fetchResult.notModified) {
          await touchOpportunity(entry.loc, { etag: fetchResult.etag });
          skipped++;
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        // Content-hash check — skip Claude if page is unchanged
        const contentHash = hashContent(fetchResult.text);
        if (meta?.hash && meta.hash === contentHash) {
          await touchOpportunity(entry.loc, { etag: fetchResult.etag, hash: contentHash });
          skipped++;
          await sleep(RATE_LIMIT_MS);
          continue;
        }

        const opps = await extractFromPage(fetchResult.text, entry.loc, source.country);
        const outbound = source.isAggregator ? pickOutboundLink(fetchResult.text, entry.loc) : null;
        for (const opp of opps) {
          if (outbound) opp.url = outbound;
          else if (!opp.url) opp.url = entry.loc;
          const enriched = applySourceMeta(opp, source);
          await upsert(enriched, enriched.featured_image_url ?? fetchResult.ogImage ?? null);
        }
        // Store hash for next run (update the in-memory cache entry too)
        if (norm && cache.urls.has(norm)) {
          cache.urls.set(norm, { last_seen_at: new Date().toISOString(), etag: fetchResult.etag, hash: contentHash });
        }
      } catch (err) {
        console.error(`    ✗ ${entry.loc}: ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
      await sleep(RATE_LIMIT_MS);
    }
  } else {
    let text: string;
    let mainOgImage: string | null;
    let page1Links: string[];

    if (source.needsBrowser && source.pages && source.pages > 1 && source.paginationUrl) {
      // Reuse a single browser context across all paginated pages (cheaper than one context per page)
      const pageUrls = [source.url];
      for (let p = 2; p <= source.pages; p++) {
        pageUrls.push(source.paginationUrl.replace("{page}", String(p)));
      }
      const pageResults = await fetchPaginatedWithBrowser(pageUrls);
      text = pageResults[0]?.text ?? "";
      mainOgImage = pageResults[0]?.ogImage ?? null;
      const allPageLinks = pageResults.flatMap((r) => r.links);
      page1Links = allPageLinks;
      // Early-stop detection not needed here; we fetched everything at once
    } else {
      const mainFetch = source.needsBrowser
        ? await fetchWithBrowser(source.url)
        : await fetchPageContent(source.url);
      text = mainFetch.text;
      mainOgImage = mainFetch.ogImage;
      page1Links = mainFetch.links;
    }

    // Collect links from additional pages (non-browser paginated sources only)
    let allLinks = [...page1Links];
    if (!source.needsBrowser && source.pages && source.pages > 1 && source.paginationUrl) {
      for (let p = 2; p <= source.pages; p++) {
        const pageUrl = source.paginationUrl.replace("{page}", String(p));
        try {
          const { links: pageLinks } = await fetchPageContent(pageUrl);
          // Stop paginating early if this page returned no new links
          if (pageLinks.length === 0) {
            console.log(`  ↳ pagination stopped at page ${p} (no links found)`);
            break;
          }
          allLinks = [...allLinks, ...pageLinks];
          await sleep(PAGINATION_RATE_LIMIT_MS);
        } catch (err) {
          console.warn(`  ⚠ Page ${p} failed: ${err instanceof Error ? err.message : String(err)}`);
          break; // don't keep paginating if a page errors
        }
      }
    }

    const ogImage = mainOgImage;
    const links = allLinks;

    if (source.followLinks && links.length > 0) {
      const detailLinks = filterLinks(links, {
        baseUrl: source.url,
        linkPattern: source.linkPattern,
        maxLinks: source.maxLinks ?? 10,
      });

      // Pre-filter: skip links whose URLs are already in the dedup cache
      const newLinks = detailLinks.filter(link => !cache.urls.has(normalizeUrl(link)));
      const cachedCount = detailLinks.length - newLinks.length;

      const DETAIL_BUDGET = parseInt(process.env.SOURCE_DETAIL_BUDGET ?? "200", 10);
      const budgeted = newLinks.slice(0, DETAIL_BUDGET);

      const pageNote = source.pages && source.pages > 1 ? `, across ${source.pages} pages` : "";
      console.log(`  ↳ ${detailLinks.length} links found${pageNote}; ${budgeted.length} new (capped at ${DETAIL_BUDGET}), ${cachedCount} already known`);

      for (const link of budgeted) {
        try {
          if (!await isAllowedByRobots(link)) {
            console.log(`    ⊘ robots.txt disallows ${link}`);
            skipped++;
            continue;
          }

          const norm = normalizeUrl(link);
          const meta = cache.urls.get(norm);
          const fetchResult = await fetchPageContent(link, {
            ifNoneMatch: meta?.etag ?? null,
            ifModifiedSince: meta?.last_seen_at ?? null,
          });

          if (fetchResult.notModified) {
            await touchOpportunity(link, { etag: fetchResult.etag });
            skipped++;
            await sleep(RATE_LIMIT_MS);
            continue;
          }

          const contentHash = hashContent(fetchResult.text);
          if (meta?.hash && meta.hash === contentHash) {
            await touchOpportunity(link, { etag: fetchResult.etag, hash: contentHash });
            skipped++;
            await sleep(RATE_LIMIT_MS);
            continue;
          }

          const opps = await extractFromPage(fetchResult.text, link, source.country);
          // For aggregator sources, prefer the outbound provider link over the aggregator URL
          const outbound = source.isAggregator ? pickOutboundLink(fetchResult.text, link) : null;
          for (const opp of opps) {
            if (outbound) opp.url = outbound;
            else if (!opp.url) opp.url = link;
            const enriched = applySourceMeta(opp, source);
            await upsert(enriched, enriched.featured_image_url ?? fetchResult.ogImage ?? ogImage ?? null);
          }
        } catch (err) {
          console.error(`    ✗ ${link}: ${err instanceof Error ? err.message : String(err)}`);
          errors++;
        }
        await sleep(RATE_LIMIT_MS);
      }
    } else {
      const opps = await extractFromPage(text, source.url, source.country);
      console.log(`  ↳ ${opps.length} opportunities extracted`);
      for (const opp of opps) {
        const enriched = applySourceMeta(opp, source);
        await upsert(enriched, enriched.featured_image_url ?? ogImage ?? null);
      }
    }
  }

  return { inserted, updated, skipped, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // SCRAPER_TIER env var selects which quarter to run (1–4). Unset = run all.
  const tierEnv = process.env.SCRAPER_TIER;
  const tier = tierEnv ? parseInt(tierEnv, 10) : null;
  const activeSources = tier ? getChunk(sources, tier) : sources;

  const label = tier ? `Tier ${tier}` : "All tiers";
  console.log(`\n🎨 Patronage Scraper — ${label}`);
  console.log(`📋 ${activeSources.length} / ${sources.length} sources queued\n`);

  // Load dedup cache once — shared across all sources in this run
  console.log("Loading dedup cache from database...");
  const cache = await loadDedupeCache();

  let inserted = 0, updated = 0, skipped = 0, errors = 0, timedOut = 0;

  for (const [i, source] of activeSources.entries()) {
    const prefix = `[${i + 1}/${activeSources.length}]`;
    console.log(`${prefix} ${source.name}${source.needsBrowser ? " 🌐" : ""}`);

    try {
      const result = await withTimeout(processSource(source, cache), SOURCE_TIMEOUT_MS);
      inserted += result.inserted;
      updated  += result.updated;
      skipped  += result.skipped;
      errors   += result.errors;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("Timed out")) {
        console.warn(`  ⏱ ${source.name} — timed out, skipping`);
        timedOut++;
      } else {
        console.error(`  ✗ Failed: ${msg}`);
        errors++;
      }
    }

    if (i < activeSources.length - 1) await sleep(RATE_LIMIT_MS);
  }

  await closeBrowser();

  const durationS = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n✅ Done (${durationS}s)`);
  console.log(`   Inserted  : ${inserted}`);
  console.log(`   Updated   : ${updated}`);
  console.log(`   Skipped   : ${skipped}`);
  console.log(`   Errors    : ${errors}`);
  console.log(`   Timed out : ${timedOut}`);
  console.log(`   Total new : ${inserted + updated}\n`);

  // Write stats for CI artifact collection + Slack notification
  const statsPath = process.env.SCRAPER_STATS_PATH;
  if (statsPath) {
    writeFileSync(
      statsPath,
      JSON.stringify({
        tier: tier ?? "all",
        sources: activeSources.length,
        inserted,
        updated,
        skipped,
        errors,
        timed_out: timedOut,
        duration_s: durationS,
      }, null, 2)
    );
    console.log(`📄 Stats → ${statsPath}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
