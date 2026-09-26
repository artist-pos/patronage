import { NextResponse } from "next/server";
import { getCitiesWithRegions } from "@/lib/regions";
import type { JoinCity } from "@/components/auth/PlaceField";

// The taxonomy changes only by migration.
const CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

/**
 * The town list for signup popups that open on pages which don't otherwise
 * load it (the opportunities grid). Fetched when the location field appears,
 * so the page itself never carries it. Only the fields the town search reads.
 */
export async function GET() {
  const cities = await getCitiesWithRegions();
  const body: JoinCity[] = cities.map((c) => ({
    id: c.id,
    name: c.name,
    name_maori: c.name_maori,
    aliases: c.aliases,
    is_major: c.is_major,
    region_id: c.region_id,
    region: c.region ? { id: c.region.id, name: c.region.name } : null,
  }));
  return NextResponse.json(body, { headers: { "Cache-Control": CACHE } });
}
