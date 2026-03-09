import "dotenv/config";
import { sources } from "./sources/index.js";
import { fetchPageContent, fetchWithBrowser, fetchRssFeed, resolveOrgImage, closeBrowser, sleep } from "./lib/fetch.js";
import { extractFromPage, extractFromRssItem } from "./lib/extract.js";
import { upsertOpportunity } from "./lib/upsert.js";
import type { Source } from "./types.js";
import type { ScrapedOpportunity } from "./types.js";

const RATE_LIMIT_MS = 2000; // 2s between requests — respectful to servers

/** Merge source-level discipline hints into a scraped opportunity. */
function applySourceMeta(opp: ScrapedOpportunity, source: Source): ScrapedOpportunity {
  const merged = [...new Set([...(opp.disciplines ?? []), ...(source.disciplines ?? [])])];
  return { ...opp, disciplines: merged };
}

async function main() {
  console.log(`\n🎨 Patronage Scraper`);
  console.log(`📋 ${sources.length} sources queued\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [i, source] of sources.entries()) {
    const prefix = `[${i + 1}/${sources.length}]`;
    const browserTag = source.needsBrowser ? " 🌐" : "";
    console.log(`${prefix} ${source.name}${browserTag}`);

    try {
      if (source.isRss) {
        // ── RSS feed ────────────────────────────────────────────────────────
        const items = await fetchRssFeed(source.url);
        console.log(`  ↳ ${items.length} RSS items`);

        for (const item of items) {
          const opps = await extractFromRssItem(item, source.url, source.country);
          for (const opp of opps) {
            if (!opp.url && item.link) opp.url = item.link;
            const enriched = applySourceMeta(opp, source);
            const image =
              enriched.featured_image_url ??
              (await resolveOrgImage(enriched.url, source.url));
            const result = await upsertOpportunity(enriched, source.url, image, {
              disciplines: source.disciplines,
              is_recurring: source.is_recurring,
              recurrence_pattern: source.recurrence_pattern,
            });
            if (result === "inserted") inserted++;
            else if (result === "updated") updated++;
            else skipped++;
          }
        }
      } else {
        // ── HTML page (static or browser) ───────────────────────────────────
        const { text, ogImage, links } = source.needsBrowser
          ? await fetchWithBrowser(source.url)
          : await fetchPageContent(source.url);

        if (source.followLinks && links.length > 0) {
          // ── Deep scrape: follow each individual opportunity link ───────────
          const detailLinks = links.slice(0, source.maxLinks ?? 20);
          console.log(`  ↳ following ${detailLinks.length} links`);

          for (const link of detailLinks) {
            try {
              const { text: dText, ogImage: dOgImage } = await fetchPageContent(link);
              const opps = await extractFromPage(dText, link, source.country);
              for (const opp of opps) {
                if (!opp.url) opp.url = link;
                const enriched = applySourceMeta(opp, source);
                const image = enriched.featured_image_url ?? dOgImage ?? ogImage ?? (await resolveOrgImage(enriched.url, source.url));
                const result = await upsertOpportunity(enriched, source.url, image, {
                  disciplines: source.disciplines,
                  is_recurring: source.is_recurring,
                  recurrence_pattern: source.recurrence_pattern,
                });
                if (result === "inserted") inserted++;
                else if (result === "updated") updated++;
                else skipped++;
              }
            } catch (err) {
              console.error(`    ✗ ${link}: ${err instanceof Error ? err.message : String(err)}`);
            }
            await sleep(RATE_LIMIT_MS);
          }
        } else {
          // ── Standard: extract from the page directly ───────────────────────
          const opps = await extractFromPage(text, source.url, source.country);
          console.log(`  ↳ ${opps.length} opportunities extracted`);

          for (const opp of opps) {
            const enriched = applySourceMeta(opp, source);
            const image =
              enriched.featured_image_url ??
              ogImage ??
              (await resolveOrgImage(enriched.url, source.url));
            const result = await upsertOpportunity(enriched, source.url, image, {
              disciplines: source.disciplines,
              is_recurring: source.is_recurring,
              recurrence_pattern: source.recurrence_pattern,
            });
            if (result === "inserted") inserted++;
            else if (result === "updated") updated++;
            else skipped++;
          }
        }
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }

    if (i < sources.length - 1) await sleep(RATE_LIMIT_MS);
  }

  await closeBrowser();

  console.log(`\n✅ Done`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Updated  : ${updated}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Errors   : ${errors}`);
  console.log(`   Total new: ${inserted + updated}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
