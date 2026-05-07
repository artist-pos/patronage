import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/public/opportunities", "/api/public/artists"],
      disallow: ["/admin", "/dashboard", "/inbox", "/api"],
    },
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/sitemap-artists.xml`,
      `${BASE_URL}/sitemap-opportunities.xml`,
      `${BASE_URL}/sitemap-blog.xml`,
    ],
  };
}
