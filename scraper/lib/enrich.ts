import { fetchPageContent } from "./fetch.js";
import { extractFromPage } from "./extract.js";
import { isAllowedByRobots } from "./robots.js";
import { normTitle, normOrganiser, tokenSortRatio } from "./dedupe.js";
import type { ScrapedOpportunity, Source } from "../types.js";

/**
 * Aggregator pages (ArtInfoLand, e-flux and the like) carry a thin summary; the
 * real details live on the organiser's own page that the "Apply" / "Official
 * site" link points to. Without this pass the scraper stored the summary and an
 * admin had to open the original link and re-parse by hand.
 *
 * For an aggregator hit we now fetch that outbound page, run the same extraction
 * on it, and merge: the organiser's page wins on dates, money and contact
 * details, and fills anything the aggregator left blank.
 *
 *   SCRAPER_ENRICH=0           switch the pass off
 *   SCRAPER_ENRICH_MAX=100     cap on outbound pages fetched per run
 *   SCRAPER_ENRICH_MODEL=...   model for this pass (e.g. a Sonnet id); defaults to the usual extractor
 */

const MAX_PER_RUN = parseInt(process.env.SCRAPER_ENRICH_MAX ?? "100", 10);
const MODEL = process.env.SCRAPER_ENRICH_MODEL || undefined;
let used = 0;

type Rich = ScrapedOpportunity & {
  sub_categories?: string[];
  career_stage?: string[];
  tags?: string[];
};

const blank = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

function union(a?: string[] | null, b?: string[] | null): string[] | undefined {
  const merged = [...new Set([...(a ?? []), ...(b ?? [])])];
  return merged.length ? merged : undefined;
}

/** The extracted item on the organiser's page that is the same opportunity as `base`. */
function pickMatch(base: ScrapedOpportunity, found: ScrapedOpportunity[]): ScrapedOpportunity | null {
  if (found.length === 0) return null;
  const scored = found
    .map((f) => ({ f, score: tokenSortRatio(normTitle(base.title), normTitle(f.title)) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0].score >= 55) return scored[0].f;
  // One item on the page from the same organisation: almost certainly this listing.
  if (found.length === 1 && tokenSortRatio(normOrganiser(base.organiser), normOrganiser(found[0].organiser)) >= 50) {
    return found[0];
  }
  return null;
}

export function mergeOpportunity(base: ScrapedOpportunity, rich: ScrapedOpportunity): ScrapedOpportunity {
  const b = base as Rich;
  const r = rich as Rich;
  const longer = (x: string | null, y: string | null) => ((y ?? "").length > (x ?? "").length ? y : x);

  const merged: Rich = {
    ...b,
    // Fills only.
    caption: blank(b.caption) ? r.caption : b.caption,
    featured_image_url: blank(b.featured_image_url) ? r.featured_image_url : b.featured_image_url,
    full_description: longer(b.full_description, r.full_description),
    // The organiser's own page is authoritative for these when it states them.
    opens_at: r.opens_at ?? b.opens_at,
    deadline: r.deadline ?? b.deadline,
    funding_range: r.funding_range ?? b.funding_range,
    contact_email: r.contact_email ?? b.contact_email,
    disciplines: union(b.disciplines, r.disciplines) ?? [],
    sub_categories: union(b.sub_categories, r.sub_categories),
    career_stage: union(b.career_stage, r.career_stage),
    tags: union(b.tags, r.tags),
  };
  return merged;
}

export async function enrichFromOutbound(
  opp: ScrapedOpportunity,
  outboundUrl: string,
  source: Source
): Promise<{ opp: ScrapedOpportunity; ogImage: string | null }> {
  if (process.env.SCRAPER_ENRICH === "0" || used >= MAX_PER_RUN) return { opp, ogImage: null };
  try {
    if (!(await isAllowedByRobots(outboundUrl))) return { opp, ogImage: null };
    used++;
    const page = await fetchPageContent(outboundUrl);
    if (page.notModified || !page.text) return { opp, ogImage: page.ogImage };
    const found = await extractFromPage(page.text, outboundUrl, opp.country, { strictGeo: false, model: MODEL });
    const match = pickMatch(opp, found);
    if (!match) return { opp, ogImage: page.ogImage };
    console.log(`    ↳ enriched from ${new URL(outboundUrl).hostname}`);
    return { opp: mergeOpportunity(opp, { ...match, url: opp.url }), ogImage: page.ogImage };
  } catch (err) {
    // Never lose the listing because the organiser's site is down or odd.
    if (err instanceof Error && err.name === "InsufficientCreditsError") throw err;
    return { opp, ogImage: null };
  }
}
