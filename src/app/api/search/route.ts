import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ opportunities: [], artists: [] });

  const supabase = await createClient();
  const p = `%${q}%`;

  const oppSelect = "id, slug, title, organiser, type, country, city, deadline, featured_image_url";
  const [{ data: byFields }, { data: bySubCats }, { data: artists }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(oppSelect)
      .eq("is_active", true)
      .or(
        `title.ilike.${p},organiser.ilike.${p},description.ilike.${p},caption.ilike.${p},city.ilike.${p},grant_type.ilike.${p}`
      )
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("opportunities")
      .select(oppSelect)
      .eq("is_active", true)
      .filter("sub_categories::text", "ilike", p)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, medium, country, career_stage")
      .eq("is_active", true)
      .or(`full_name.ilike.${p},username.ilike.${p},bio.ilike.${p}`)
      .limit(5),
  ]);

  const seen = new Set<string>();
  const opportunities = [...(byFields ?? []), ...(bySubCats ?? [])]
    .filter((o) => { if (seen.has(o.id)) return false; seen.add(o.id); return true; })
    .slice(0, 5);

  return NextResponse.json({
    opportunities,
    artists: artists ?? [],
  });
}
