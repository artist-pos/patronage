import Link from "next/link";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { computeBadges } from "@/lib/badges";
import { RegionPageView, RegionTrackedLink } from "@/components/artists/RegionAnalytics";
import { regionFullName } from "@/lib/regions";
import type { Region } from "@/types/database";
import type { RegionalPageData } from "@/lib/regions";

interface Props {
  region: Region;
  data: RegionalPageData;
  /** Per-artist counts the badge helper needs. */
  worksCountMap: Map<string, number>;
  collectedSet: Set<string>;
}

function fmtDeadline(d: string | null): string {
  if (!d) return "Rolling deadline";
  return `Closes ${new Date(d + "T00:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

/**
 * The public page for one region.
 *
 * Written to be worth landing on from a search for "artists in Waikato": who
 * works here, what they make, what is open nearby, and what they have been
 * doing lately.
 */
export function RegionView({ region, data, worksCountMap, collectedSet }: Props) {
  const { anchorOrg, artists, disciplines, opportunities, updates } = data;
  const fullName = regionFullName(region);

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
            ? `${artists.length} artist${artists.length !== 1 ? "s" : ""} working in ${fullName}. Browse portfolios, available works, and studio updates.`
            : `No one has listed ${fullName} as their base yet. If you work here, you could be the first.`}
        </p>

        {disciplines.length > 0 && (
          <p className="text-sm text-[color:var(--fg-muted)]">
            {disciplines.join(" · ")}
          </p>
        )}
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
      {artists.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Artists
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <RegionTrackedLink
                key={artist.id}
                href={`/${artist.username}`}
                event="regional_page_artist_click"
                regionSlug={region.slug}
                properties={{ artist_username: artist.username }}
                className="block"
              >
                <ArtistCard
                  artist={artist}
                  view="gallery"
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
              </RegionTrackedLink>
            ))}
          </div>
        </section>
      )}

      {/* ── Live opportunities in the region ── */}
      {opportunities.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Open in {region.name}
          </h2>
          <div className="grid grid-cols-1 gap-[2px] bg-feed-bg sm:grid-cols-2 lg:grid-cols-3">
            {opportunities.map((o) => (
              <Link
                key={o.id}
                href={`/opportunities/${o.slug ?? o.id}`}
                className="flex gap-3 bg-card p-3 transition-colors hover:bg-[color:var(--tint)]"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-white">
                  {o.featured_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.featured_image_url}
                      alt=""
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="px-1 text-center font-mono text-[8px] font-semibold uppercase text-[color:var(--fg-subtle)]">
                      {o.type}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="mb-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                    {o.organiser}
                  </p>
                  <p className="mb-1 text-[13px] font-semibold leading-[1.35]">{o.title}</p>
                  <p className="truncate text-[12px] text-[color:var(--fg-muted)]">
                    {[o.city, o.type, o.funding_range].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[12px] text-[color:var(--fg-subtle)]">
                    {fmtDeadline(o.deadline)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent studio updates ── */}
      {updates.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            From the studio
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {updates.map((u) => (
              <Link key={u.id} href={`/updates/${u.id}`} className="group block">
                {u.image_url ? (
                  <div className="mb-1.5 overflow-hidden bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.image_url}
                      alt={u.caption ?? `Studio update by ${u.artist_full_name ?? u.artist_username}`}
                      className="h-auto w-full"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="mb-1.5 bg-[color:var(--surface-muted)] p-4">
                    <p className="line-clamp-4 text-[12px] leading-[1.5]">
                      {u.caption ?? u.text_content ?? "Studio update"}
                    </p>
                  </div>
                )}
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)] transition-colors group-hover:text-foreground">
                  {u.artist_full_name ?? u.artist_username}
                </p>
              </Link>
            ))}
          </div>
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
            Are you an organisation in {region.name}? Claim your profile.
          </p>
          <RegionTrackedLink
            href="/auth/signup?role=partner"
            event="regional_page_signup_click"
            regionSlug={region.slug}
            properties={{ cta: "organisation" }}
            signupContext={{ source: "regional_page", regionId: region.id }}
            className="inline-flex items-center border border-border px-[22px] py-3 text-sm font-medium text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
          >
            Claim your profile →
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
