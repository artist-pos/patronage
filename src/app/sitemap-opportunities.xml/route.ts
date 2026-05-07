import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export async function GET() {
  const supabase = await createClient();
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, slug, created_at, deadline")
    .eq("is_active", true)
    .eq("status", "published");

  const today = new Date().toISOString().slice(0, 10);
  const urls = (opportunities ?? []).map((o) => {
    const upcoming = o.deadline ? o.deadline >= today : false;
    return {
      loc: `${BASE_URL}/opportunities/${o.slug ?? o.id}`,
      lastmod: o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : today,
      changefreq: upcoming ? "weekly" : "monthly",
      priority: upcoming ? "0.9" : "0.6",
    };
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
