import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const page       = Math.max(1, parseInt(searchParams.get("page")   ?? "1", 10));
  const limit      = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
  const country    = searchParams.get("country")    ?? null;
  const discipline = searchParams.get("discipline") ?? null;

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select(
      `username, full_name, bio,
       avatar_url, featured_image_url,
       country, career_stage,
       disciplines, medium,
       website_url, instagram_handle,
       exhibition_history, received_grants,
       is_patronage_supported, created_at`,
      { count: "exact" }
    )
    .eq("is_active", true)
    .in("role", ["artist", "owner"])
    .order("created_at", { ascending: false });

  if (country)    query = query.eq("country", country);
  if (discipline) query = query.contains("disciplines", [discipline]);

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const DISCIPLINE_LABELS: Record<string, string> = {
    visual_art: "Visual Art", music: "Music", poetry: "Poetry",
    writing: "Writing", dance: "Dance", film: "Film",
    photography: "Photography", craft: "Craft", performance: "Performance", other: "Other",
  };

  const artists = (data ?? []).map((p: any) => ({
    url:         `${SITE_URL}/${p.username}`,
    username:    p.username,
    full_name:   p.full_name,
    bio:         p.bio,
    avatar_url:  p.avatar_url,
    featured_image_url: p.featured_image_url,
    country:     p.country,
    career_stage: p.career_stage,
    disciplines: (p.disciplines ?? []).map((d: string) => ({
      value: d,
      label: DISCIPLINE_LABELS[d] ?? d,
    })),
    medium:      p.medium ?? [],
    links: {
      website:   p.website_url,
      instagram: p.instagram_handle
        ? `https://instagram.com/${p.instagram_handle}`
        : null,
    },
    exhibition_count: (p.exhibition_history ?? []).length,
    grants_received:  (p.received_grants ?? []).length,
    is_patronage_supported: p.is_patronage_supported ?? false,
    created_at:  p.created_at,
  }));

  const total    = count ?? 0;
  const has_more = from + limit < total;

  return NextResponse.json(
    {
      data: artists,
      meta: { total, page, limit, has_more },
    },
    {
      headers: { "Cache-Control": CACHE },
    }
  );
}
