import { Suspense } from "react";
import Link from "next/link";
import { getProfiles, getProfileById } from "@/lib/profiles";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getCachedDirectoryData } from "@/lib/artists-directory";
import { HandleChips } from "@/components/artists/HandleChips";
import { byCompleteness, isPresentable } from "@/lib/artist-completeness";
import { ArtistCard, type WorkPreview } from "@/components/artists/ArtistCard";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import { ArtistSpotlightHero } from "@/components/artists/ArtistSpotlightHero";
import { AdminSpotlightMenu } from "@/components/artists/AdminSpotlightMenu";
import { computeBadges } from "@/lib/badges";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";
import { getAvatarGradient } from "@/lib/defaults";
import type { CountryEnum, CareerStageEnum, DisciplineEnum, ProfileWithImage } from "@/types/database";

export const metadata = {
  title: "Artists",
  description: "Browse verified New Zealand and Australian artists.",
  alternates: { canonical: "https://patronage.nz/artists" },
};

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string; discipline?: string; commissions?: string }>;
}

// Work-first card: who, where, what they make, and three works shown large.
function WorkCard({ artist, works }: { artist: ProfileWithImage; works: WorkPreview[] }) {
  const name = artist.full_name ?? artist.username;
  const place = [artist.city, artist.country].filter(Boolean).join(", ");
  const disciplines = (artist.medium ?? []).slice(0, 3);
  const gradient = getAvatarGradient(artist.username);
  return (
    <Link href={`/${artist.username}`} className="pin group block h-full bg-card p-3.5">
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
            style={{ background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.015em]">{name}</p>
          {place && <p className="truncate text-[12px] text-[color:var(--fg-muted)]">{place}</p>}
        </div>
        {artist.open_for_commissions && (
          <span className="shrink-0 text-[11px] text-[color:var(--success)]" title="Open for commissions">
            ● Open
          </span>
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

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;
  const discipline = params.discipline as DisciplineEnum | undefined;
  const openForCommissions = params.commissions === "1";

  const today = new Date().toISOString().split("T")[0];
  // Viewer profile chains off auth so it overlaps the directory queries.
  const [artists, { collectedIds, worksCounts, worksPreviews, spotlightProfileId }, viewerProfile] =
    await Promise.all([
      getProfiles({ country, career_stage, discipline, openForCommissions }),
      getCachedDirectoryData(today),
      getServerUser().then(({ user }) => (user ? getProfileById(user.id) : null)),
    ]);
  const isAdmin = viewerProfile?.role === "admin" || viewerProfile?.role === "owner";

  const collectedSet = new Set(collectedIds);
  const hasFilters = !!(country || career_stage || discipline || openForCommissions);
  const spotlightArtist =
    !hasFilters && spotlightProfileId ? (artists.find((a) => a.id === spotlightProfileId) ?? null) : null;
  const rest = spotlightArtist ? artists.filter((a) => a.id !== spotlightArtist.id) : artists;

  const worksFor = (a: ProfileWithImage) => {
    const w = worksPreviews[a.id] ?? [];
    return w.length >= 3 ? w : null;
  };
  // Untagged (null country) stays domestic — most bare signups never set one.
  const isInternational = (a: ProfileWithImage) => !!a.country && a.country !== "NZ" && a.country !== "AUS";

  // Tiers: work cards for anyone presentable with three works (domestic
  // first), then presentable rows, then international, then bare signups as
  // handles — never fake directory entries.
  const presentable = rest.filter(isPresentable).sort(byCompleteness);
  const withWorks = [
    ...presentable.filter((a) => !isInternational(a) && worksFor(a)),
    ...presentable.filter((a) => isInternational(a) && worksFor(a)),
  ];
  const moreDomestic = presentable.filter((a) => !isInternational(a) && !worksFor(a));
  const moreInternational = presentable.filter((a) => isInternational(a) && !worksFor(a));
  const unpresentable = rest.filter((a) => !isPresentable(a));
  const recentlyJoined = unpresentable.filter((a) => !isInternational(a));
  const internationalHandles = unpresentable.filter(isInternational);

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

  // Admin-only spotlight control, kept outside the card's link.
  const spotlightMenu = (a: ProfileWithImage) =>
    isAdmin ? (
      <AdminSpotlightMenu
        profileId={a.id}
        artistName={a.full_name ?? a.username}
        isSpotlit={a.id === spotlightProfileId}
      />
    ) : null;

  const rows = (list: ProfileWithImage[]) => (
    <div className="border-t border-border">
      {list.map((a) => (
        <div key={a.id} className="flex items-stretch">
          <div className="min-w-0 flex-1">
            <ArtistCard artist={a} view="list" badges={badgesFor(a)} />
          </div>
          {isAdmin && (
            <div className="flex items-center border-b border-border bg-card pr-1.5">{spotlightMenu(a)}</div>
          )}
        </div>
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
          {spotlightArtist && (
            <div className="relative">
              <ArtistSpotlightHero artist={spotlightArtist} />
              {isAdmin && <div className="absolute right-2 top-2 z-10">{spotlightMenu(spotlightArtist)}</div>}
            </div>
          )}

          {rest.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No artists match those filters.</p>
          )}

          {withWorks.length > 0 && (
            <section className="space-y-3">
              <p className="t-section-label">Directory</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {withWorks.map((a) => (
                  <div key={a.id} className="relative">
                    <WorkCard artist={a} works={worksFor(a)!} />
                    {isAdmin && <div className="absolute right-1.5 top-1.5 z-10 bg-card">{spotlightMenu(a)}</div>}
                  </div>
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

          {(moreInternational.length > 0 || internationalHandles.length > 0) && (
            <section className="space-y-3">
              <p className="t-section-label">International</p>
              {moreInternational.length > 0 && rows(moreInternational)}
              {internationalHandles.length > 0 && <HandleChips artists={internationalHandles} />}
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
