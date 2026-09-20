import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

// Arts organisations, galleries, residencies and other partners with a public
// profile. Kept apart from the artist sitemap so each can be read on its own.
export async function GET() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, created_at")
    .eq("is_active", true)
    .eq("role", "partner")
    // Only organisations that have said something about themselves. An empty
    // profile is a thin page, and submitting it does the site no favours.
    .not("bio", "is", null)
    .neq("bio", "");

  const today = new Date().toISOString().slice(0, 10);
  const urls = (profiles ?? []).map((p) => ({
    loc: `${BASE_URL}/${p.username}`,
    lastmod: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : today,
    changefreq: "weekly",
    priority: "0.7",
  }));

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
