import "dotenv/config";
import { sources } from "./sources/index.js";
import { fetchPageContent, fetchRssFeed, sleep } from "./lib/fetch.js";
import { extractFromPage, extractFromRssItem } from "./lib/extract.js";
import { upsertOpportunity } from "./lib/upsert.js";

const RATE_LIMIT_MS = 2000; // 2s between requests — respectful to servers

async function main() {
  console.log(`\n🎨 Patronage Scraper`);
  console.log(`📋 ${sources.length} sources queued\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [i, source] of sources.entries()) {
    const prefix = `[${i + 1}/${sources.length}]`;
    console.log(`${prefix} ${source.name}`);

    try {
      if (source.isRss) {
        // ── RSS feed ────────────────────────────────────────────────────────
        const items = await fetchRssFeed(source.url);
        console.log(`  ↳ ${items.length} RSS items`);

        for (const item of items) {
          const opps = await extractFromRssItem(item, source.url, source.country);
          for (const opp of opps) {
            // Use the item's own link as the opportunity URL if extraction didn't find one
            if (!opp.url && item.link) opp.url = item.link;
            const result = await upsertOpportunity(opp, source.url, null);
            if (result === "inserted") inserted++;
            else if (result === "updated") updated++;
            else skipped++;
          }
        }
      } else {
        // ── HTML page ───────────────────────────────────────────────────────
        const { text, ogImage } = await fetchPageContent(source.url);
        const opps = await extractFromPage(text, source.url, source.country);
        console.log(`  ↳ ${opps.length} opportunities extracted`);

        for (const opp of opps) {
          const result = await upsertOpportunity(opp, source.url, ogImage);
          if (result === "inserted") inserted++;
          else if (result === "updated") updated++;
          else skipped++;
        }
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }

    // Rate limit between sources
    if (i < sources.length - 1) await sleep(RATE_LIMIT_MS);
  }

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
