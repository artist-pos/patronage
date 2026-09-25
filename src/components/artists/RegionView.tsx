import Link from "next/link";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { computeBadges } from "@/lib/badges";
import { RegionPageView, RegionTrackedArea, RegionTrackedLink } from "@/components/artists/RegionAnalytics";
import { HandleChips } from "@/components/artists/HandleChips";
import { MasonryGrid } from "@/components/opportunities/MasonryGrid";
import { byCompleteness, isPresentable } from "@/lib/artist-completeness";
import { regionalTownLabel } from "@/lib/region-location";
import { regionFullName } from "@/lib/regions";
import type { City, Region } from "@/types/database";
import type { RegionalPageData } from "@/lib/regions";

interface Props {
  region: Region;
  data: RegionalPageData;
  /** Per-artist counts the badge helper needs. */
  worksCountMap: Map<string, number>;
  collectedSet: Set<string>;
  /** The region's towns, so an artist's town reads as the taxonomy name rather
   *  than whatever they typed. */
  cities: City[];
}

/**
 * The public page for one region.
 *
 * Written to be worth landing on from a search for "artists in Waikato": who
 * works here, what they make, and what is open nearby.
 */
export function RegionView({ region, data, worksCountMap, collectedSet, cities }: Props) {
  const { anchorOrg, artists, opportunities } = data;
  const fullName = regionFullName(region);

  // Same split as the /artists directory: profiles with a name or image lead as
  // cards, most complete first; bare signups follow as handles.
  const cityNameById = new Map(cities.map((c) => [c.id, c.name]));
  const shown = artists.filter(isPresentable).sort(byCompleteness);
  const recentlyJoined = artists.filter((a) => !isPresentable(a));

  const townLabel = (a: (typeof artists)[number]) =>
    regionalTownLabel(a, region.name, cityNameById);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-12">
      <RegionPageView regionSlug={region.slug} />

      {/* ── Header ── */}
      <header className="space-y-3">
        <nav className="text-xs text-muted-foreground">
          <Link href="/artists" className="transition-colors hover:text-foreground">
            Artists
          </Link>
          <span className="mx-1.5">›</span>
          <span>{region.name}</span>
        </nav>

        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Artists in {region.name}
        </h1>
        {region.name_maori && region.name_maori !== region.name && (
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            {region.name_maori}
          </p>
        )}

        <p className="max-w-2xl text-sm text-muted-foreground">
          {artists.length > 0
            ? `${artists.length} artist${artists.length !== 1 ? "s" : ""} working in ${fullName}. Browse portfolios and available works.`
            : `No one has listed ${fullName} as their base yet. If you work here, you could be the first.`}
        </p>
      </header>

      {/* ── Anchor organisation ──
          The region's arts body. Featured rather than listed, and deliberately
          not presented as representing anyone: its relationship to artists
          here is geographic. */}
      {anchorOrg && (
        <section>
          <Link
            href={`/${anchorOrg.username}`}
            className="flex flex-col gap-4 bg-[color:var(--brand-sub)] p-6 transition-opacity hover:opacity-90 sm:flex-row sm:items-center"
          >
            {anchorOrg.avatar_url && (
              <div className="h-16 w-16 shrink-0 overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={anchorOrg.avatar_url}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
                Arts organisation for {region.name}
              </p>
              <p className="mb-1 text-[17px] font-semibold leading-[1.3]">
                {anchorOrg.full_name ?? anchorOrg.username}
              </p>
              {anchorOrg.bio && (
                <p className="line-clamp-2 text-[13.5px] leading-[1.55] text-[color:var(--fg-muted)]">
                  {anchorOrg.bio}
                </p>
              )}
            </div>
          </Link>
        </section>
      )}

      {/* ── Artists ── */}
      {shown.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
              Artists
            </h2>
            <Link href="/artists" className="font-mono text-[11px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((artist) => (
              <RegionTrackedArea
                key={artist.id}
                event="regional_page_artist_click"
                regionSlug={region.slug}
                properties={{ artist_username: artist.username }}
              >
                <ArtistCard
                  artist={artist}
                  view="gallery"
                  locationText={townLabel(artist)}
                  badges={computeBadges(
                    {
                      ...artist,
                      received_grants:
                        (artist as { received_grants?: string[] }).received_grants ?? [],
                    },
                    worksCountMap.get(artist.id) ?? 0,
                    collectedSet.has(artist.id)
                  )}
                />
              </RegionTrackedArea>
            ))}
          </div>
        </section>
      )}

      {recentlyJoined.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Recently joined
          </h2>
          <HandleChips artists={recentlyJoined} />
        </section>
      )}

      {/* ── Live opportunities in the region ── */}
      {opportunities.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
              Opportunities in {region.name}
            </h2>
            <Link href="/opportunities" className="font-mono text-[11px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground">
              View all &rarr;
            </Link>
          </div>
          <MasonryGrid opportunities={opportunities} view="gallery" />
        </section>
      )}

      {/* ── CTAs ── */}
      <section className="grid grid-cols-1 gap-[2px] bg-feed-bg sm:grid-cols-2">
        <div className="flex flex-col items-start gap-3 bg-[color:var(--brand-sub)] p-6">
          <p className="text-[15px] leading-[1.5]">
            Are you an artist working in {region.name}? Create your free Patronage
            profile.
          </p>
          <RegionTrackedLink
            href="/auth/signup?role=artist"
            event="regional_page_signup_click"
            regionSlug={region.slug}
            properties={{ cta: "artist" }}
            signupContext={{ source: "regional_page", regionId: region.id }}
            className="inline-flex items-center bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            Create your profile →
          </RegionTrackedLink>
        </div>

        <div className="flex flex-col items-start gap-3 bg-card p-6">
          <p className="text-[15px] leading-[1.5]">
            Are you an organisation in {region.name}? Partner with us.
          </p>
          <RegionTrackedLink
            href="/auth/signup?role=partner"
            event="regional_page_signup_click"
            regionSlug={region.slug}
            properties={{ cta: "organisation" }}
            signupContext={{ source: "regional_page", regionId: region.id }}
            className="inline-flex items-center border border-border px-[22px] py-3 text-sm font-medium text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
          >
            Create a partner organisation profile →
          </RegionTrackedLink>
        </div>
      </section>

      <div className="border-t border-border pt-6">
        <Link
          href="/artists"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All artists
        </Link>
      </div>
    </div>
  );
}
