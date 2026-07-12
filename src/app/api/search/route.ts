import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  // Strip leading @ so searching "@username" works the same as "username"
  const q = raw.startsWith("@") ? raw.slice(1) : raw;
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
    // PostgREST can't ilike a text[] column (and ::text casts aren't allowed
    // in filters — this errored with `operator does not exist: text[] ~~*`).
    // Match whole tags instead, trying the query as typed plus Title Case.
    supabase
      .from("opportunities")
      .select(oppSelect)
      .eq("is_active", true)
      .overlaps("sub_categories", [
        q.trim(),
        q.trim().charAt(0).toUpperCase() + q.trim().slice(1).toLowerCase(),
      ])
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
