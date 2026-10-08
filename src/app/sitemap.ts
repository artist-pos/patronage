import type { MetadataRoute } from "next";
import { HUB_CONTENT, HUB_COUNTRY_MAP, HUB_TYPE_LABEL } from "@/lib/hub-content";
import { getRegions } from "@/lib/regions";
import { MIN_INDEXABLE_LISTINGS, REGIONAL_HUB_TYPES, getRegionalHubCounts } from "@/lib/regional-hubs";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

const CATEGORY_SLUGS = [
  "new-zealand", "australia", "global",
  "visual-art", "music", "poetry", "writing", "dance", "film", "photography", "craft", "performance",
];

// Hub type + country combinations, e.g. /opportunities/grants/new-zealand
// Only the pairs that have editorial content: the others 404.
const HUB_COUNTRY_SLUGS = Object.keys(HUB_TYPE_LABEL).flatMap((type) =>
  Object.keys(HUB_COUNTRY_MAP)
    .filter((country) => HUB_CONTENT[`${type}/${country}`])
    .map((country) => ({ type, country }))
);

// Static routes and the regional pages. Dynamic content lives in named
// sub-sitemaps:
//   /sitemap-artists.xml
//   /sitemap-organisations.xml
//   /sitemap-opportunities.xml
//   /sitemap-blog.xml
//
// No lastModified on these: they change whenever the data behind them does, and
// stamping every URL with "now" on each request teaches crawlers to ignore the
// field. The sub-sitemaps carry real dates.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [regions, hubCounts] = await Promise.all([getRegions(), getRegionalHubCounts()]);

  // Type x region pages, only where there is enough live to be worth a result
  // (the pages themselves carry noindex below the same threshold).
  const regionalHubs = REGIONAL_HUB_TYPES.flatMap((type) =>
    regions
      .filter((r) => (hubCounts[type]?.[r.slug] ?? 0) >= MIN_INDEXABLE_LISTINGS)
      .map((r) => ({
        url: `${BASE_URL}/opportunities/${type}/${r.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      }))
  );

  return [
    // ── Core browse surfaces ──────────────────────────────────────────────────
    { url: BASE_URL,                              changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/opportunities`,           changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/artists`,                 changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/works`,                   changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/patrons`,                 changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/live`,                    changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/feed`,                    changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/search`,                  changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/blog`,                    changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/resources`,               changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/about`,                   changeFrequency: "monthly", priority: 0.6 },

    // ── Opportunity category hubs ─────────────────────────────────────────────
    { url: `${BASE_URL}/opportunities/grants`,      changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/opportunities/residencies`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/opportunities/open-calls`,  changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/opportunities/prizes`,      changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/opportunities/jobs`,        changeFrequency: "daily", priority: 0.8 },

    // ── Partners / consultancy ────────────────────────────────────────────────
    { url: `${BASE_URL}/partners`,                           changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/partners/construction-hoardings`,    changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/partners/vacant-shopfronts`,         changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/partners/utility-boxes`,             changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/partners/art-strategy`,              changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/partners/councils`,                  changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/partners/workplaces-and-hotels`,     changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/list-an-opportunity`,                changeFrequency: "monthly", priority: 0.6 },

    // ── Utility / legal ───────────────────────────────────────────────────────
    { url: `${BASE_URL}/get-started`,             changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/join`,                    changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/provenance`,              changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/terms`,                   changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`,                 changeFrequency: "monthly", priority: 0.3 },

    // ── Artist category filters ───────────────────────────────────────────────
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/artists/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),

    // ── Artist regional pages (DB-driven) ─────────────────────────────────────
    ...regions.map((r) => ({
      url: `${BASE_URL}/artists/${r.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),

    // ── Opportunity hub pages (type × content slug) ───────────────────────────
    ...Object.keys(HUB_CONTENT).map((slug) => ({
      url: `${BASE_URL}/opportunities/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),

    // ── Opportunity hub pages (type × country) ────────────────────────────────
    ...HUB_COUNTRY_SLUGS.map(({ type, country }) => ({
      url: `${BASE_URL}/opportunities/${type}/${country}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),

    // ── Opportunity hub pages (type × region) ─────────────────────────────────
    ...regionalHubs,
  ];
}
