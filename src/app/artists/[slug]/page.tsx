import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfiles } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { computeBadges } from "@/lib/badges";
import type { CountryEnum, DisciplineEnum } from "@/types/database";
import Link from "next/link";
import {
  getRegions,
  getRegionBySlug,
  getCitiesForRegion,
  getRegionalPageData,
  regionFullName,
} from "@/lib/regions";
import { RegionView } from "@/components/artists/RegionView";

// Revalidate every 24 hours — new artists joining won't require a full rebuild
export const revalidate = 86400;

// Only known slugs are valid — return 404 for anything else
export const dynamicParams = false;

// ── Slug → filter mappings ────────────────────────────────────────────────────

interface CountryMeta {
  kind: "country";
  value: CountryEnum;
  label: string;        // used in H1: "[label] Artists"
  adjective: string;    // used in prose: "[adjective] artists"
}

interface DisciplineMeta {
  kind: "discipline";
  value: DisciplineEnum;
  label: string;        // used in H1: plural form
  singular: string;     // "painter", "musician"
  prose: string;        // used in descriptive paragraph
}

type SlugMeta = CountryMeta | DisciplineMeta;

const SLUG_MAP: Record<string, SlugMeta> = {
  // Countries
  // profiles.country is a strict enum (NZ | AUS | Global). Only these country
  // slugs are valid — UK/US/EU would throw "invalid input value for enum" → 500.
  "new-zealand": { kind: "country", value: "NZ",     label: "New Zealand",  adjective: "New Zealand-based" },
  "australia":   { kind: "country", value: "AUS",    label: "Australian",   adjective: "Australian" },
  "global":      { kind: "country", value: "Global", label: "Global",       adjective: "internationally based" },
  // Disciplines
  "visual-art":    { kind: "discipline", value: "visual_art",   label: "Visual Artists",                 singular: "visual artist",          prose: "painters, printmakers, sculptors, and visual artists" },
  "music":         { kind: "discipline", value: "music",        label: "Musicians",                      singular: "musician",               prose: "composers, performers, producers, and musicians" },
  "poetry":        { kind: "discipline", value: "poetry",       label: "Poets",                          singular: "poet",                   prose: "poets and spoken-word artists" },
  "writing":       { kind: "discipline", value: "writing",      label: "Writers",                        singular: "writer",                 prose: "novelists, essayists, and writers" },
  "dance":         { kind: "discipline", value: "dance",        label: "Dancers & Choreographers",       singular: "dancer or choreographer", prose: "dancers, choreographers, and movement artists" },
  "film":          { kind: "discipline", value: "film",         label: "Filmmakers",                     singular: "filmmaker",              prose: "directors, cinematographers, and filmmakers" },
  "photography":   { kind: "discipline", value: "photography",  label: "Photographers",                  singular: "photographer",           prose: "photographers and lens-based artists" },
  "craft":         { kind: "discipline", value: "craft",        label: "Craft Artists",                  singular: "craft artist",           prose: "ceramicists, textile artists, and craft makers" },
  "performance":   { kind: "discipline", value: "performance",  label: "Performance Artists",            singular: "performance artist",     prose: "performance and interdisciplinary artists" },
};

// ── Static params ─────────────────────────────────────────────────────────────

// Country and discipline slugs are fixed; region slugs come from the taxonomy
// table. dynamicParams stays false, so anything not listed here 404s rather
// than becoming an accidental public page.
export async function generateStaticParams() {
  const regions = await getRegions();
  return [
    ...Object.keys(SLUG_MAP).map((slug) => ({ slug })),
    ...regions.map((r) => ({ slug: r.slug })),
  ];
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = SLUG_MAP[slug];

  if (!meta) {
    // Region page. Artist count is part of the description because it is the
    // thing a searcher is actually weighing up before they click.
    const region = await getRegionBySlug(slug);
    if (!region) return { title: "Artists" };

    const cities = await getCitiesForRegion(region.id);
    const { artists } = await getRegionalPageData(region, cities);
    const fullName = regionFullName(region);
    const h1 = `Artists in ${region.name}`;
    const description =
      artists.length > 0
        ? `${artists.length} artist${artists.length !== 1 ? "s" : ""} based in ${fullName}. Browse portfolios, available works, and open opportunities in the region.`
        : `Artists based in ${fullName} on Patronage. Browse portfolios, available works, and open opportunities in the region.`;

    return {
      title: h1,
      description,
      alternates: { canonical: `/artists/${slug}` },
      openGraph: {
        title: `${h1} | Patronage`,
        description,
        url: `/artists/${slug}`,
        type: "website",
        siteName: "Patronage",
        locale: "en_NZ",
        // Representative image: the first artist banner we have for the region,
        // falling back to the inherited site card when the region is empty.
        ...(artists.find((a) => a.featured_image_url) && {
          images: [
            {
              url: artists.find((a) => a.featured_image_url)!.featured_image_url!,
              width: 1200,
              height: 630,
              alt: h1,
            },
          ],
        }),
      },
      twitter: { card: "summary_large_image", title: `${h1} | Patronage`, description },
    };
  }

  const h1 = meta.kind === "country"
    ? `${meta.label} Artists`
    : meta.label;

  const description = meta.kind === "country"
    ? `Browse portfolios and available works from ${meta.adjective} artists on Patronage: discover exhibition histories, studio updates, and original works.`
    : `Discover ${meta.prose} on Patronage: browse portfolios, available works, and exhibition history.`;

  return {
    title: h1,
    description,
    alternates: { canonical: `/artists/${slug}` },
    openGraph: {
      title: `${h1} | Patronage`,
      description,
      url: `/artists/${slug}`,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ArtistCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = SLUG_MAP[slug];

  // ── Region page ──
  // Shares this route so the URL reads /artists/waikato rather than being
  // nested under a second segment. Region slugs cannot collide with the
  // country and discipline slugs above.
  if (!meta) {
    const region = await getRegionBySlug(slug);
    if (!region) notFound();

    const cities = await getCitiesForRegion(region.id);
    const regionData = await getRegionalPageData(region, cities);

    // Cookie-free client throughout this branch: touching cookies() would opt
    // the page out of prerendering, and these are public reads either way.
    const supabaseRegion = createPublicClient();

    // Badge inputs, scoped to this region's artists rather than the whole
    // artworks table. The ids are only known once the artists are loaded, so
    // this is a genuine dependency, not an avoidable waterfall.
    const regionArtistIds = regionData.artists.map((a) => a.id);
    const [collectedRes, worksRes] = regionArtistIds.length
      ? await Promise.all([
          supabaseRegion
            .from("artworks")
            .select("creator_id, current_owner_id")
            .in("creator_id", regionArtistIds),
          supabaseRegion
            .from("artworks")
            .select("profile_id")
            .in("profile_id", regionArtistIds),
        ])
      : [{ data: [] }, { data: [] }];

    const regionCollected = new Set(
      (collectedRes.data ?? [])
        .filter(
          (r: { creator_id: string | null; current_owner_id: string | null }) =>
            r.creator_id && r.current_owner_id && r.current_owner_id !== r.creator_id
        )
        .map((r: { creator_id: string | null }) => r.creator_id as string)
    );

    const regionWorksCount = new Map<string, number>();
    for (const row of worksRes.data ?? []) {
      const r = row as { profile_id: string };
      regionWorksCount.set(r.profile_id, (regionWorksCount.get(r.profile_id) ?? 0) + 1);
    }

    return (
      <RegionView
        region={region}
        data={regionData}
        worksCountMap={regionWorksCount}
        collectedSet={regionCollected}
        cities={cities}
      />
    );
  }

  const filter =
    meta.kind === "country"
      ? { country: meta.value }
      : { discipline: meta.value };

  const supabase = await createClient();

  const [artists, collectedResult, worksCountResult] = await Promise.all([
    getProfiles(filter),
    // Column-to-column comparison isn't possible in a PostgREST filter —
    // fetch both ids and compare in JS.
    supabase
      .from("artworks")
      .select("creator_id, current_owner_id"),
    supabase
      .from("artworks")
      .select("profile_id"),
  ]);

  const collectedSet = new Set(
    (collectedResult.data ?? [])
      .filter((r: { creator_id: string | null; current_owner_id: string | null }) =>
        r.creator_id && r.current_owner_id && r.current_owner_id !== r.creator_id)
      .map((r: { creator_id: string | null }) => r.creator_id as string)
  );

  const worksCountMap = new Map<string, number>();
  for (const row of worksCountResult.data ?? []) {
    const r = row as { profile_id: string };
    worksCountMap.set(r.profile_id, (worksCountMap.get(r.profile_id) ?? 0) + 1);
  }

  const h1 = meta.kind === "country"
    ? `${meta.label} Artists`
    : meta.label;

  const prose = meta.kind === "country"
    ? `Discover ${meta.adjective} artists on Patronage: browse portfolios, available works, studio updates, and exhibition history from active ${meta.adjective} artists in our community.`
    : `Discover ${meta.prose} on Patronage: browse portfolios, available works, studio updates, and exhibition history from active ${meta.singular}s in our community.`;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-8">
      <div className="space-y-3">
        <nav className="text-xs text-muted-foreground">
          <Link href="/artists" className="hover:text-foreground transition-colors">Artists</Link>
          <span className="mx-1.5">›</span>
          <span>{h1}</span>
        </nav>

        <h1 className="text-2xl font-semibold tracking-tight">{h1}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{prose}</p>
        <p className="text-xs text-muted-foreground">
          {artists.length} artist{artists.length !== 1 ? "s" : ""}
        </p>
      </div>

      {artists.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No artists in this category yet.</p>
          <Link href="/artists" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
            Browse all artists →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.id}
              artist={artist}
              view="gallery"
              badges={computeBadges(
                { ...artist, received_grants: (artist as { received_grants?: string[] }).received_grants ?? [] },
                worksCountMap.get(artist.id) ?? 0,
                collectedSet.has(artist.id)
              )}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <Link href="/artists" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← All artists
        </Link>
      </div>
    </div>
  );
}
