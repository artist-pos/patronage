import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

const CATEGORY_SLUGS = [
  "new-zealand", "australia", "uk", "us", "eu", "global",
  "visual-art", "music", "poetry", "writing", "dance", "film", "photography", "craft", "performance",
];

// Static routes only. Dynamic content lives in named sub-sitemaps:
//   /sitemap-artists.xml
//   /sitemap-opportunities.xml
//   /sitemap-blog.xml
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL,                    lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/opportunities`, lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/artists`,       lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/works`,         lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/feed`,          lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/blog`,          lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/partner`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/artists/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
