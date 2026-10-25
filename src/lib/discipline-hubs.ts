import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { CARD_FIELDS } from "@/lib/opportunity-card-fields";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";
import { HUB_TYPE_LABEL, HUB_TYPE_MAP } from "@/lib/hub-content";
import { REGIONAL_HUB_TYPES, MIN_INDEXABLE_LISTINGS } from "@/lib/regional-hubs";
import type { Opportunity } from "@/types/database";

export { MIN_INDEXABLE_LISTINGS };

/** Countries a Patronage reader can realistically apply from: NZ, Australia, or open to all. */
const HUB_COUNTRIES = ["NZ", "AUS", "Global"];

/** slug -> label, e.g. "visual-art" -> "Visual Art". "Other" is a catch-all, not a page. */
export const DISCIPLINE_HUBS: Record<string, string> = Object.fromEntries(
  DISCIPLINE_OPTIONS.filter((d) => d.value !== "other").map((d) => [d.value.replace(/_/g, "-"), d.label])
);

export function isDisciplineSlug(value: string): boolean {
  return value in DISCIPLINE_HUBS;
}

/** Live listings of one type tagged with one discipline: /opportunities/<type>/<discipline>. */
export const getDisciplineOpportunities = unstable_cache(
  async (typeSlug: string, disciplineLabel: string): Promise<Opportunity[]> => {
    const oppType = HUB_TYPE_MAP[typeSlug];
    if (!oppType) return [];
    const supabase = createPublicClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("opportunities")
      .select(CARD_FIELDS)
      .eq("is_active", true)
      .eq("status", "published")
      .eq("type", oppType)
      .in("country", HUB_COUNTRIES)
      .contains("sub_categories", [disciplineLabel])
      .or(`deadline.gte.${today},deadline.is.null`)
      .order("is_featured", { ascending: false })
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(60);
    return (data ?? []) as unknown as Opportunity[];
  },
  ["discipline-opportunities"],
  { revalidate: 300, tags: ["regional-opportunities"] }
);

/** type slug -> discipline slug -> live listings. One query for the sitemap and chips. */
export type DisciplineHubCounts = Record<string, Record<string, number>>;

export const getDisciplineHubCounts = unstable_cache(
  async (): Promise<DisciplineHubCounts> => {
    const typeSlugByEnum = new Map(REGIONAL_HUB_TYPES.map((slug) => [HUB_TYPE_MAP[slug], slug]));
    const slugByLabel = new Map(Object.entries(DISCIPLINE_HUBS).map(([slug, label]) => [label, slug]));
    const supabase = createPublicClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("opportunities")
      .select("type, sub_categories")
      .eq("is_active", true)
      .eq("status", "published")
      .in("type", [...typeSlugByEnum.keys()])
      .in("country", HUB_COUNTRIES)
      .or(`deadline.gte.${today},deadline.is.null`)
      .limit(5000);

    const counts: DisciplineHubCounts = {};
    for (const slug of REGIONAL_HUB_TYPES) counts[slug] = {};
    for (const row of (data ?? []) as { type: string; sub_categories: string[] | null }[]) {
      const typeSlug = typeSlugByEnum.get(row.type);
      if (!typeSlug) continue;
      for (const sub of row.sub_categories ?? []) {
        const disc = slugByLabel.get(sub);
        if (disc) counts[typeSlug][disc] = (counts[typeSlug][disc] ?? 0) + 1;
      }
    }
    return counts;
  },
  ["discipline-hub-counts"],
  { revalidate: 300, tags: ["regional-opportunities"] }
);

export { HUB_TYPE_LABEL };
