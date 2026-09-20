import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  City,
  CityWithRegion,
  LocalBoard,
  Opportunity,
  Profile,
  ProjectUpdateWithArtist,
  Region,
} from "@/types/database";

/** Taxonomy rows change only when a migration runs, so they cache for a day
 *  rather than the five minutes the browse surfaces use. */
const TAXONOMY_TTL = 86_400;

export const getRegions = unstable_cache(
  async (): Promise<Region[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("regions")
      .select("*")
      .order("sort_order", { ascending: true });
    return (data ?? []) as Region[];
  },
  ["regions-all"],
  { revalidate: TAXONOMY_TTL, tags: ["regions"] }
);

export const getRegionBySlug = unstable_cache(
  async (slug: string): Promise<Region | null> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("regions")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return (data as Region) ?? null;
  },
  ["region-by-slug"],
  { revalidate: TAXONOMY_TTL, tags: ["regions"] }
);

/**
 * Every city, joined to its region.
 *
 * The whole taxonomy is roughly a hundred rows, so the picker ships it once and
 * filters in the browser. That beats a query per keystroke, and it means the
 * dropdown keeps working while someone is on a bad connection in a studio.
 */
export const getCitiesWithRegions = unstable_cache(
  async (): Promise<CityWithRegion[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("cities")
      .select(
        "id, region_id, slug, name, name_maori, aliases, is_major, created_at, region:regions!cities_region_id_fkey (id, slug, name, name_maori)"
      )
      .order("name", { ascending: true });
    return (data ?? []) as unknown as CityWithRegion[];
  },
  ["cities-with-regions"],
  { revalidate: TAXONOMY_TTL, tags: ["regions"] }
);

/** Sub-areas of a region (Auckland's local boards). A handful of rows that
 *  change only by migration, so cached like the rest of the taxonomy. */
export const getLocalBoards = unstable_cache(
  async (): Promise<LocalBoard[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("local_boards")
      .select("id, region_id, slug, name, name_maori")
      .order("name", { ascending: true });
    return (data ?? []) as LocalBoard[];
  },
  ["local-boards"],
  { revalidate: TAXONOMY_TTL, tags: ["regions"] }
);

export const getCitiesForRegion = unstable_cache(
  async (regionId: string): Promise<City[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("cities")
      .select("*")
      .eq("region_id", regionId)
      .order("is_major", { ascending: false })
      .order("name", { ascending: true });
    return (data ?? []) as City[];
  },
  ["cities-for-region"],
  { revalidate: TAXONOMY_TTL, tags: ["regions"] }
);

/** Region name for display: "Waikato" alone, or "Auckland / Tāmaki Makaurau". */
export function regionFullName(region: Pick<Region, "name" | "name_maori">): string {
  return region.name_maori && region.name_maori !== region.name
    ? `${region.name} / ${region.name_maori}`
    : region.name;
}

/** Same idea for a city. */
export function cityFullName(city: Pick<City, "name" | "name_maori">): string {
  return city.name_maori && city.name_maori !== city.name
    ? `${city.name} / ${city.name_maori}`
    : city.name;
}

/**
 * Comparison key matching the SQL location_key() used by the 183 backfill:
 * lowercased, macrons folded, punctuation stripped. Keeping the two in step
 * means a city typed in the picker matches the same way a migrated one did.
 */
export function locationKey(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "");
}

/** Ranked client-side search over the taxonomy. Exact match, then prefix,
 *  then substring; larger centres break ties. */
export function searchCities(cities: CityWithRegion[], query: string, limit = 8): CityWithRegion[] {
  const q = locationKey(query);
  if (!q) return cities.filter((c) => c.is_major).slice(0, limit);

  const scored: Array<{ city: CityWithRegion; score: number }> = [];

  for (const city of cities) {
    const candidates = [city.name, city.name_maori, ...city.aliases]
      .filter(Boolean)
      .map((c) => locationKey(c as string));

    let best = 0;
    for (const cand of candidates) {
      if (!cand) continue;
      if (cand === q) best = Math.max(best, 100);
      else if (cand.startsWith(q)) best = Math.max(best, 70);
      else if (cand.includes(q)) best = Math.max(best, 40);
    }
    // The region name is searchable too, so typing "waikato" surfaces its towns.
    if (best === 0 && locationKey(city.region?.name).includes(q)) best = 20;

    if (best > 0) scored.push({ city, score: best + (city.is_major ? 5 : 0) });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name))
    .slice(0, limit)
    .map((s) => s.city);
}

// ─── Regional page data ───────────────────────────────────────────────────────


/** The subset of an organisation profile a regional page renders. */
export type RegionalOrg = Pick<
  Profile,
  "id" | "username" | "full_name" | "bio" | "avatar_url" | "featured_image_url" | "org_category"
>;

export interface RegionalPageData {
  /** The region's arts body, featured at the top. It represents nobody — its
   *  relationship to artists here is geographic. Null where none has claimed
   *  the region. */
  anchorOrg: RegionalOrg | null;
  artists: Array<Profile & { primary_image_url: string | null }>;
  /** Discipline / medium labels present in this region, most common first. */
  disciplines: string[];
  opportunities: Array<
    Pick<
      Opportunity,
      "id" | "slug" | "title" | "organiser" | "type" | "city" | "country" |
      "deadline" | "featured_image_url" | "funding_range" | "funding_amount"
    >
  >;
  updates: ProjectUpdateWithArtist[];
}

/**
 * Everything a regional page renders, in one parallel wave.
 *
 * Opportunities are matched on the listing's freeform `city` against the
 * region's town names, because opportunities were never migrated onto the
 * taxonomy — they are scraped from fifty-odd sources and their location text
 * is not ours to normalise. Artists, which we do control, match on region_id.
 */
export async function getRegionalPageData(
  region: Region,
  cities: City[]
): Promise<RegionalPageData> {
  const supabase = createPublicClient();
  const today = new Date().toISOString().split("T")[0];

  // Every spelling a listing might use for a town in this region.
  const cityNames = [
    ...new Set(
      cities.flatMap((c) =>
        [c.name, c.name_maori, ...c.aliases].filter(Boolean) as string[]
      )
    ),
  ];

  const artistsPromise = supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .eq("region_id", region.id)
    .in("role", ["artist", "owner"])
    .order("created_at", { ascending: false })
    .limit(60);

  // The region's arts body, and only that. Galleries are deliberately not
  // listed here: this page is about the artists who work in the region, and a
  // "galleries in Waikato" section turns it into a directory. A gallery is
  // reached through the artists it represents, or through its own profile.
  const ORG_FIELDS =
    "id, username, full_name, bio, avatar_url, featured_image_url, org_category";
  const orgsPromise = supabase
    .from("profiles")
    .select(ORG_FIELDS)
    .eq("is_active", true)
    .eq("role", "partner")
    .eq("region_id", region.id)
    .eq("org_category", "regional_arts_org")
    .limit(4);

  const [artistsRes, oppsRes, orgsRes] = await Promise.all([
    artistsPromise,
    cityNames.length > 0
      ? supabase
          .from("opportunities")
          .select(
            "id, slug, title, organiser, type, city, country, deadline, featured_image_url, funding_range, funding_amount"
          )
          .eq("is_active", true)
          .eq("status", "published")
          .in("city", cityNames)
          .or(`deadline.gte.${today},deadline.is.null`)
          .order("deadline", { ascending: true, nullsFirst: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    orgsPromise,
  ]);

  const orgs = (orgsRes.data ?? []) as unknown as RegionalOrg[];
  // Only one organisation anchors a region. If two have claimed it, the first
  // is shown and the clash is a moderation problem, not a rendering one.
  const anchorOrg = orgs.find((o) => o.org_category === "regional_arts_org") ?? null;

  const artists = ((artistsRes.data ?? []) as Profile[]).map((p) => ({
    ...p,
    primary_image_url: p.featured_image_url ?? null,
  }));

  // Studio updates depend on knowing who the region's artists are, so this one
  // genuinely cannot start earlier.
  const artistIds = artists.map((a) => a.id);
  const updatesRes = artistIds.length
    ? await supabase
        .from("project_updates")
        .select(
          "*, profiles!project_updates_artist_id_fkey (username, full_name, avatar_url)"
        )
        .in("artist_id", artistIds)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] };

  // Discipline breakdown, commonest first. `medium` is free text and
  // `disciplines` is the enum; both are counted so a region reads the way its
  // artists describe themselves.
  const counts = new Map<string, number>();
  for (const a of artists) {
    for (const label of [...(a.medium ?? []), ...(a.disciplines ?? [])]) {
      const clean = label?.trim();
      if (!clean) continue;
      const key = clean.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const disciplines = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([label]) => label);

  return {
    anchorOrg,
    artists,
    disciplines,
    opportunities: (oppsRes.data ?? []) as RegionalPageData["opportunities"],
    updates: (updatesRes.data ?? []) as unknown as ProjectUpdateWithArtist[],
  };
}

/** A regional arts body, as offered to an artist choosing theirs. */
export interface ArtsOrganisation {
  id: string;
  username: string;
  name: string;
  region_id: string | null;
}

/**
 * Every regional arts organisation on the platform.
 *
 * A handful of rows that change rarely, so the picker ships the list and sorts
 * the artist's own region to the top in the browser rather than querying per
 * region. Cached alongside the taxonomy because it changes on the same cadence.
 */
export const getArtsOrganisations = unstable_cache(
  async (): Promise<ArtsOrganisation[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, region_id")
      .eq("role", "partner")
      .eq("is_active", true)
      .eq("org_category", "regional_arts_org")
      .order("full_name", { ascending: true });

    return ((data ?? []) as Array<{
      id: string;
      username: string;
      full_name: string | null;
      region_id: string | null;
    }>).map((o) => ({
      id: o.id,
      username: o.username,
      name: o.full_name ?? o.username,
      region_id: o.region_id,
    }));
  },
  ["arts-organisations"],
  { revalidate: TAXONOMY_TTL, tags: ["regions"] }
);
