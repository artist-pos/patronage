import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: profiles }, { data: opportunities }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, created_at")
      .eq("is_active", true),
    supabase
      .from("opportunities")
      .select("id, slug, created_at, deadline")
      .eq("is_active", true)
      .eq("status", "published"),
  ]);

  const CATEGORY_SLUGS = [
    "new-zealand", "australia", "uk", "us", "eu", "global",
    "visual-art", "music", "poetry", "writing", "dance", "film", "photography", "craft", "performance",
  ];

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                        lastModified: new Date(), changeFrequency: "daily",  priority: 1.0 },
    { url: `${BASE_URL}/opportunities`,     lastModified: new Date(), changeFrequency: "daily",  priority: 1.0 },
    { url: `${BASE_URL}/artists`,           lastModified: new Date(), changeFrequency: "daily",  priority: 1.0 },
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/artists/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${BASE_URL}/${p.username}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const opportunityRoutes: MetadataRoute.Sitemap = (opportunities ?? []).map((o) => ({
    url: `${BASE_URL}/opportunities/${o.slug ?? o.id}`,
    lastModified: o.deadline
      ? new Date(o.deadline + "T00:00:00")
      : o.created_at
      ? new Date(o.created_at)
      : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...profileRoutes, ...opportunityRoutes];
}
