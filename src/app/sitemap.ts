import type { MetadataRoute } from "next";
import { HUB_CONTENT } from "@/lib/hub-content";
import { getRegions } from "@/lib/regions";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

const CATEGORY_SLUGS = [
  "new-zealand", "australia", "global",
  "visual-art", "music", "poetry", "writing", "dance", "film", "photography", "craft", "performance",
];

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
  const regions = await getRegions();

  return [
    { url: BASE_URL,                           changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/opportunities`,        changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/artists`,              changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/works`,                changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/support`,              changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/live`,                 changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/feed`,                 changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/blog`,                 changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/resources`,            changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/partners`,             changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/list-an-opportunity`,  changeFrequency: "monthly", priority: 0.6 },
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/artists/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    // One page per region, from the region taxonomy.
    ...regions.map((r) => ({
      url: `${BASE_URL}/artists/${r.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...Object.keys(HUB_CONTENT).map((slug) => ({
      url: `${BASE_URL}/opportunities/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
