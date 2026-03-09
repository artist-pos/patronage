import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Cache for 1 hour at the CDN; serve stale for up to 24 h while revalidating
const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
  const type    = searchParams.get("type")    ?? null;
  const country = searchParams.get("country") ?? null;

  const supabase = await createClient();

  let query = supabase
    .from("opportunities")
    .select(
      `id, slug, title, organiser, type, country, city,
       opens_at, deadline,
       funding_amount, funding_range,
       caption, full_description,
       url, featured_image_url,
       sub_categories, disciplines,
       entry_fee, artist_payment_type,
       travel_support, travel_support_details,
       is_recurring, recurrence_pattern,
       is_featured, view_count,
       created_at`,
      { count: "exact" }
    )
    .eq("is_active", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (type)    query = query.eq("type", type);
  if (country) query = query.eq("country", country);

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const opportunities = (data ?? []).map((o: any) => ({
    id:          o.id,
    slug:        o.slug,
    url:         `${SITE_URL}/opportunities/${o.slug ?? o.id}`,
    title:       o.title,
    organiser:   o.organiser,
    type:        o.type,
    country:     o.country,
    city:        o.city,
    opens_at:    o.opens_at,
    deadline:    o.deadline,
    funding: {
      amount:    o.funding_amount,
      range:     o.funding_range,
    },
    description:  o.caption ?? o.full_description ?? null,
    full_description: o.full_description ?? null,
    external_url: o.url,
    image_url:    o.featured_image_url,
    categories:   o.sub_categories ?? [],
    disciplines:  o.disciplines ?? [],
    transparency: {
      entry_fee:             o.entry_fee,
      artist_payment_type:   o.artist_payment_type,
      travel_support:        o.travel_support,
      travel_support_details: o.travel_support_details,
    },
    is_recurring:       o.is_recurring ?? false,
    recurrence_pattern: o.recurrence_pattern ?? null,
    is_featured:        o.is_featured ?? false,
    view_count:         o.view_count ?? 0,
    created_at:         o.created_at,
  }));

  const total    = count ?? 0;
  const has_more = from + limit < total;

  return NextResponse.json(
    {
      data: opportunities,
      meta: { total, page, limit, has_more },
    },
    {
      headers: { "Cache-Control": CACHE },
    }
  );
}
