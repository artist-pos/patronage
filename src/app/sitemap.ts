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
      .select("id, created_at")
      .eq("is_active", true),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/artists`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/opportunities`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/partners`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${BASE_URL}/${p.username}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const opportunityRoutes: MetadataRoute.Sitemap = (opportunities ?? []).map((o) => ({
    url: `${BASE_URL}/opportunities/${o.id}`,
    lastModified: o.created_at ? new Date(o.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...profileRoutes, ...opportunityRoutes];
}
