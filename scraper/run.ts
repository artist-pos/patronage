import "dotenv/config";
import { writeFileSync } from "fs";
import { sources } from "./sources/index.js";
import {
  fetchPageContent,
  fetchWithBrowser,
  fetchRssFeed,
  resolveOrgImage,
  closeBrowser,
  sleep,
} from "./lib/fetch.js";
import { extractFromPage, extractFromRssItem } from "./lib/extract.js";
import { upsertOpportunity } from "./lib/upsert.js";
import { filterLinks } from "./lib/filter-links.js";
import type { Source, ScrapedOpportunity } from "./types.js";

const RATE_LIMIT_MS = 2_000;
const SOURCE_TIMEOUT_MS = 120_000; // increased from 30s — sources with many links need more time

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

async function processSource(source: Source): Promise<SourceResult> {
  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  async function upsert(opp: ScrapedOpportunity, image: string | null) {
    const result = await upsertOpportunity(opp, source.url, image, {
      disciplines: source.disciplines,
      is_recurring: source.is_recurring,
      recurrence_pattern: source.recurrence_pattern,
    });
    if (result === "inserted") inserted++;
    else if (result === "updated") updated++;
    else skipped++;
  }

  if (source.isRss) {
    const items = await fetchRssFeed(source.url);
    console.log(`  ↳ ${items.length} RSS items`);
    for (const item of items) {
      const opps = await extractFromRssItem(item, source.url, source.country);
      for (const opp of opps) {
        if (!opp.url && item.link) opp.url = item.link;
        const enriched = applySourceMeta(opp, source);
        const image = enriched.featured_image_url ?? (await resolveOrgImage(enriched.url, source.url));
        await upsert(enriched, image);
      }
    }
  } else {
    const { text, ogImage, links } = source.needsBrowser
      ? await fetchWithBrowser(source.url)
      : await fetchPageContent(source.url);

    if (source.followLinks && links.length > 0) {
      const detailLinks = filterLinks(links, {
        baseUrl: source.url,
        linkPattern: source.linkPattern,
        maxLinks: source.maxLinks ?? 10,
      });
      console.log(`  ↳ following ${detailLinks.length} links (filtered from ${links.length})`);

      for (const link of detailLinks) {
        try {
          const { text: dText, ogImage: dOg } = await fetchPageContent(link);
          const opps = await extractFromPage(dText, link, source.country);
          for (const opp of opps) {
            if (!opp.url) opp.url = link;
            const enriched = applySourceMeta(opp, source);
            const image = enriched.featured_image_url ?? dOg ?? ogImage
              ?? (await resolveOrgImage(enriched.url, source.url));
            await upsert(enriched, image);
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
        const image = enriched.featured_image_url ?? ogImage
          ?? (await resolveOrgImage(enriched.url, source.url));
        await upsert(enriched, image);
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

  let inserted = 0, updated = 0, skipped = 0, errors = 0, timedOut = 0;

  for (const [i, source] of activeSources.entries()) {
    const prefix = `[${i + 1}/${activeSources.length}]`;
    console.log(`${prefix} ${source.name}${source.needsBrowser ? " 🌐" : ""}`);

    try {
      const result = await withTimeout(processSource(source), SOURCE_TIMEOUT_MS);
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
