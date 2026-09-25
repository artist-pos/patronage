import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getProfiles } from "@/lib/profiles";
import { getCachedDirectoryData } from "@/lib/artists-directory";
import { HandleChips } from "@/components/artists/HandleChips";
import { byCompleteness, isPresentable } from "@/lib/artist-completeness";
import { ArtistCard, type WorkPreview } from "@/components/artists/ArtistCard";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import { ArtistSpotlightHero } from "@/components/artists/ArtistSpotlightHero";
import { computeBadges } from "@/lib/badges";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";
import { getAvatarGradient } from "@/lib/defaults";
import type { CountryEnum, CareerStageEnum, DisciplineEnum, ProfileWithImage } from "@/types/database";

// Hidden preview of a work-first directory: artists with three works get a
// two-column card showing them large; everyone else stays a compact row.
export const metadata: Metadata = {
  title: "Artists v2 (preview)",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string; discipline?: string; commissions?: string }>;
}

function WorkCard({ artist, works }: { artist: ProfileWithImage; works: WorkPreview[] }) {
  const name = artist.full_name ?? artist.username;
  const place = [artist.city, artist.country].filter(Boolean).join(", ");
  const disciplines = (artist.medium ?? []).slice(0, 3);
  return (
    <Link href={`/${artist.username}`} className="pin group block bg-card p-3.5">
      <div className="mb-3 flex items-center gap-2.5">
        {artist.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artist.avatar_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-9 w-9 shrink-0 object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[13px] font-semibold text-white/90"
            style={{
              background: `linear-gradient(135deg, ${getAvatarGradient(artist.username).from} 0%, ${getAvatarGradient(artist.username).to} 100%)`,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.015em]">{name}</p>
          {place && <p className="truncate text-[12px] text-[color:var(--fg-muted)]">{place}</p>}
        </div>
        {artist.open_for_commissions && (
          <span className="shrink-0 text-[11px] text-[color:var(--success)]" title="Open for commissions">● Open</span>
        )}
      </div>
      {/* Discipline tags — same bordered mono chips as the list rows. */}
      {disciplines.length > 0 && (
        <div className="mb-3 flex gap-1 overflow-hidden">
          {disciplines.map((m) => (
            <span
              key={m}
              className="whitespace-nowrap border border-border px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-[color:var(--fg-muted)]"
            >
              {m}
            </span>
          ))}
        </div>
      )}
      {/* Plain <img>: variable-ratio artwork, cropped to squares for an even row. */}
      <div className="grid grid-cols-3 gap-1">
        {works.map((w, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            data-pin-img
            src={w.src}
            alt={w.title ?? `Work by ${name}`}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full bg-muted object-cover"
          />
        ))}
      </div>
    </Link>
  );
}

export default async function ArtistsV2Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;
  const discipline = params.discipline as DisciplineEnum | undefined;
  const openForCommissions = params.commissions === "1";

  const today = new Date().toISOString().split("T")[0];
  const [artists, { collectedIds, worksCounts, worksPreviews, spotlightProfileId }] = await Promise.all([
    getProfiles({ country, career_stage, discipline, openForCommissions }),
    getCachedDirectoryData(today),
  ]);

  const collectedSet = new Set(collectedIds);
  const hasFilters = !!(country || career_stage || discipline || openForCommissions);
  const spotlightArtist =
    !hasFilters && spotlightProfileId ? (artists.find((a) => a.id === spotlightProfileId) ?? null) : null;
  const rest = spotlightArtist ? artists.filter((a) => a.id !== spotlightArtist.id) : artists;

  const worksFor = (a: ProfileWithImage) => {
    const w = worksPreviews[a.id] ?? [];
    return w.length >= 3 ? w : null;
  };
  const isInternational = (a: ProfileWithImage) => !!a.country && a.country !== "NZ" && a.country !== "AUS";

  // Cards: anyone presentable with three works, domestic first.
  const presentable = rest.filter(isPresentable).sort(byCompleteness);
  const withWorks = [
    ...presentable.filter((a) => !isInternational(a) && worksFor(a)),
    ...presentable.filter((a) => isInternational(a) && worksFor(a)),
  ];
  const moreDomestic = presentable.filter((a) => !isInternational(a) && !worksFor(a));
  const moreInternational = presentable.filter((a) => isInternational(a) && !worksFor(a));
  const recentlyJoined = rest.filter((a) => !isPresentable(a));

  const badgesFor = (a: ProfileWithImage) =>
    computeBadges(
      { ...a, received_grants: (a as { received_grants?: string[] }).received_grants ?? [] },
      worksCounts[a.id] ?? 0,
      collectedSet.has(a.id)
    );

  const activeFilters = [
    country,
    career_stage,
    discipline ? `Discipline: ${DISCIPLINE_OPTIONS.find((d) => d.value === discipline)?.label ?? discipline}` : null,
  ].filter(Boolean);

  const rows = (list: ProfileWithImage[]) => (
    <div className="border-t border-border">
      {list.map((a) => (
        <ArtistCard key={a.id} artist={a} view="list" badges={badgesFor(a)} />
      ))}
    </div>
  );

  return (
    <div>
      {/* ══ Header — title, count, filters ══ */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pt-7 sm:px-6">
          <div className="mb-4 flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">Artists</h1>
            <span className="font-mono text-xs text-muted-foreground">{artists.length}</span>
            {activeFilters.length > 0 && (
              <span className="font-mono text-xs text-muted-foreground">{activeFilters.join(" · ")}</span>
            )}
          </div>
          <Suspense>
            <ArtistFilters />
          </Suspense>
        </div>
      </div>

      {/* ══ Content — white cards on the feed surface ══ */}
      <div className="min-h-screen bg-feed-bg">
        <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-6 sm:px-6">
          {spotlightArtist && <ArtistSpotlightHero artist={spotlightArtist} />}

          {rest.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No artists match those filters.</p>
          )}

          {withWorks.length > 0 && (
            <section className="space-y-3">
              <p className="t-section-label">Directory</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {withWorks.map((a) => (
                  <WorkCard key={a.id} artist={a} works={worksFor(a)!} />
                ))}
              </div>
            </section>
          )}

          {moreDomestic.length > 0 && (
            <section className="space-y-3">
              <p className="t-section-label">More artists</p>
              {rows(moreDomestic)}
            </section>
          )}

          {moreInternational.length > 0 && (
            <section className="space-y-3">
              <p className="t-section-label">International</p>
              {rows(moreInternational)}
            </section>
          )}

          {recentlyJoined.length > 0 && (
            <section className="space-y-3">
              <p className="t-section-label">Recently joined</p>
              <HandleChips artists={recentlyJoined} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
