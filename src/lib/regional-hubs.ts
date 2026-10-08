import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { CARD_FIELDS } from "@/lib/opportunity-card-fields";
import { getCitiesWithRegions } from "@/lib/regions";
import { HUB_TYPE_LABEL, HUB_TYPE_MAP } from "@/lib/hub-content";
import type { City, Opportunity } from "@/types/database";

/** The opportunity types that get a page per region: /opportunities/<type>/<region>. */
export const REGIONAL_HUB_TYPES = ["grants", "residencies", "open-calls", "prizes"] as const;
export type RegionalHubType = (typeof REGIONAL_HUB_TYPES)[number];

export function isRegionalHubType(value: string): value is RegionalHubType {
  return (REGIONAL_HUB_TYPES as readonly string[]).includes(value);
}

/**
 * A page with one listing reads as thin, and a search result that opens onto a
 * near-empty grid is worse than no result. Below this the page still works for
 * anyone who follows a link, but it asks search engines to leave it out.
 */
export const MIN_INDEXABLE_LISTINGS = 2;

/** Every spelling a listing might use for a town in this region. */
export function cityNamesFor(cities: Pick<City, "name" | "name_maori" | "aliases">[]): string[] {
  return [
    ...new Set(
      cities.flatMap((c) => [c.name, c.name_maori, ...(c.aliases ?? [])].filter(Boolean) as string[])
    ),
  ];
}

/** Live listings of one type whose town sits in the region. */
export const getRegionalOpportunities = unstable_cache(
  async (cityNames: string[], typeSlug: string): Promise<Opportunity[]> => {
    const oppType = HUB_TYPE_MAP[typeSlug];
    if (!oppType || cityNames.length === 0) return [];
    const supabase = createPublicClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("opportunities")
      .select(CARD_FIELDS)
      .eq("is_active", true)
      .eq("status", "published")
      .eq("type", oppType)
      .in("city", cityNames)
      .or(`deadline.gte.${today},deadline.is.null`)
      .order("is_featured", { ascending: false })
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(60);
    return (data ?? []) as unknown as Opportunity[];
  },
  ["regional-opportunities"],
  { revalidate: 300, tags: ["regional-opportunities"] }
);

/** type slug -> region slug -> number of live listings. */
export type RegionalHubCounts = Record<string, Record<string, number>>;

/**
 * One query for every region and type, so the sitemap, the regional pages and
 * the hub chips can all ask "is there enough here to show?" without a query
 * per combination.
 */
export const getRegionalHubCounts = unstable_cache(
  async (): Promise<RegionalHubCounts> => {
    const cities = await getCitiesWithRegions();
    const regionByName = new Map<string, string>();
    for (const c of cities) {
      for (const name of cityNamesFor([c])) regionByName.set(name, c.region.slug);
    }

    const typeSlugByEnum = new Map(REGIONAL_HUB_TYPES.map((slug) => [HUB_TYPE_MAP[slug], slug]));
    const supabase = createPublicClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("opportunities")
      .select("type, city")
      .eq("is_active", true)
      .eq("status", "published")
      .in("type", [...typeSlugByEnum.keys()])
      .in("city", [...regionByName.keys()])
      .or(`deadline.gte.${today},deadline.is.null`)
      .limit(5000);

    const counts: RegionalHubCounts = {};
    for (const slug of REGIONAL_HUB_TYPES) counts[slug] = {};
    for (const row of (data ?? []) as { type: string; city: string | null }[]) {
      const typeSlug = typeSlugByEnum.get(row.type);
      const regionSlug = row.city ? regionByName.get(row.city) : undefined;
      if (!typeSlug || !regionSlug) continue;
      counts[typeSlug][regionSlug] = (counts[typeSlug][regionSlug] ?? 0) + 1;
    }
    return counts;
  },
  ["regional-hub-counts"],
  { revalidate: 300, tags: ["regional-opportunities"] }
);

/** The hubs worth linking to from a region: those with something live in them. */
export function hubLinksForRegion(
  counts: RegionalHubCounts,
  regionSlug: string
): { typeSlug: RegionalHubType; label: string; count: number }[] {
  return REGIONAL_HUB_TYPES.map((typeSlug) => ({
    typeSlug,
    label: HUB_TYPE_LABEL[typeSlug],
    count: counts[typeSlug]?.[regionSlug] ?? 0,
  })).filter((l) => l.count > 0);
}

/** "30 October 2026" from a date-only string, without the timezone sliding it a day. */
export function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export interface Faq {
  q: string;
  a: string;
}

/**
 * Questions a searcher actually types about a region, answered from live data
 * so the page says something no other page does. Rendered on the page and
 * repeated as FAQPage structured data, so the two never drift apart.
 */
export function regionPageFaqs(input: {
  regionName: string;
  regionFullName: string;
  artistCount: number;
  disciplines: string[];
  hubLinks: { label: string; count: number }[];
  nextClosing: Pick<Opportunity, "title" | "deadline"> | null;
}): Faq[] {
  const { regionName, regionFullName, artistCount, disciplines, hubLinks, nextClosing } = input;
  const faqs: Faq[] = [];

  if (artistCount > 0) {
    faqs.push({
      q: `Who are the artists based in ${regionName}?`,
      a: `${artistCount} artist${artistCount !== 1 ? "s" : ""} working in ${regionFullName} have a Patronage profile${
        disciplines.length > 0 ? `, across ${disciplines.slice(0, 5).join(", ").toLowerCase()}` : ""
      }. Each profile shows their portfolio, exhibitions and available works.`,
    });
  }

  const total = hubLinks.reduce((n, l) => n + l.count, 0);
  faqs.push({
    q: `What open calls, grants and residencies are there in ${regionName}?`,
    a:
      total > 0
        ? `${hubLinks.map((l) => `${l.count} ${l.label.toLowerCase()}`).join(", ")} ${
            total === 1 ? "is" : "are"
          } open in ${regionFullName} right now${
            nextClosing?.deadline ? `. The next to close is ${nextClosing.title}, on ${formatDeadline(nextClosing.deadline)}` : ""
          }. The list is updated weekly.`
        : `Nothing in ${regionFullName} is open right now. Patronage updates its listings weekly, and also lists opportunities across New Zealand that any artist can apply to.`,
  });

  faqs.push({
    q: `How do I get listed as an artist or organisation in ${regionName}?`,
    a: `Create a free Patronage profile and set your town, and you appear on this page. Arts organisations can list their own open calls for free.`,
  });

  return faqs;
}
