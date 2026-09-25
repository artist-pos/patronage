import { Suspense } from "react";
import { getProfiles, getProfileById } from "@/lib/profiles";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getCachedDirectoryData } from "@/lib/artists-directory";
import { HandleChips } from "@/components/artists/HandleChips";
import { byCompleteness, isPresentable } from "@/lib/artist-completeness";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import { ArtistSpotlightHero } from "@/components/artists/ArtistSpotlightHero";
import { AdminSpotlightMenu } from "@/components/artists/AdminSpotlightMenu";
import { computeBadges, type BadgeSet } from "@/lib/badges";
import type { WorkPreview } from "@/components/artists/ArtistCard";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";
import type { CountryEnum, CareerStageEnum, DisciplineEnum, ProfileWithImage } from "@/types/database";

export const metadata = {
  title: "Artists",
  description: "Browse verified New Zealand and Australian artists.",
  alternates: { canonical: "https://patronage.nz/artists" },
};

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string; discipline?: string; view?: string; commissions?: string }>;
}

// A single directory row + (for admins) the spotlight menu rail beside it.
// Shared by the Directory and International sections.
function DirectoryRow({
  artist,
  isAdmin,
  spotlightProfileId,
  badges,
  works,
}: {
  artist: ProfileWithImage;
  isAdmin: boolean;
  spotlightProfileId: string | null;
  badges: BadgeSet;
  works?: WorkPreview[];
}) {
  return (
    <div className="flex items-stretch">
      <div className="min-w-0 flex-1">
        <ArtistCard artist={artist} view="list" badges={badges} works={works} />
      </div>
      {isAdmin && (
        <div className="flex items-center border-b border-border bg-card pr-1.5">
          <AdminSpotlightMenu
            profileId={artist.id}
            artistName={artist.full_name ?? artist.username}
            isSpotlit={artist.id === spotlightProfileId}
          />
        </div>
      )}
    </div>
  );
}

// A presentable tier (Directory or International), rendered as rows or a
// gallery grid depending on the active view — used by both so the
// domestic/international/recently-joined split holds regardless of view.
function ArtistTier({
  artists,
  cardView,
  isAdmin,
  spotlightProfileId,
  badgesFor,
  worksFor,
}: {
  artists: ProfileWithImage[];
  cardView: "list" | "gallery";
  isAdmin: boolean;
  spotlightProfileId: string | null;
  badgesFor: (artist: ProfileWithImage) => BadgeSet;
  worksFor: (artist: ProfileWithImage) => WorkPreview[] | undefined;
}) {
  if (cardView === "gallery") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} view="gallery" badges={badgesFor(artist)} />
        ))}
      </div>
    );
  }
  return (
    <div className="border-t border-border">
      {artists.map((artist) => (
        <DirectoryRow
          key={artist.id}
          artist={artist}
          isAdmin={isAdmin}
          spotlightProfileId={spotlightProfileId}
          badges={badgesFor(artist)}
          works={worksFor(artist)}
        />
      ))}
    </div>
  );
}

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;
  const discipline = params.discipline as DisciplineEnum | undefined;
  const openForCommissions = params.commissions === "1";
  const view = params.view === "list" ? "list" : params.view === "gallery" ? "gallery" : "spotlight";

  const today = new Date().toISOString().split("T")[0];

  const [artists, { collectedIds, worksCounts, worksPreviews, spotlightProfileId }, { user }] = await Promise.all([
    getProfiles({ country, career_stage, discipline, openForCommissions }),
    getCachedDirectoryData(today),
    getServerUser(),
  ]);

  const viewerProfile = user ? await getProfileById(user.id) : null;
  const isAdmin = viewerProfile?.role === "admin" || viewerProfile?.role === "owner";

  // Build sets for O(1) lookups
  const collectedSet = new Set(collectedIds);
  const worksCountMap = new Map<string, number>(Object.entries(worksCounts));

  const hasFilters = !!(country || career_stage || discipline || openForCommissions);
  const spotlightArtist =
    view === "spotlight" && !hasFilters && spotlightProfileId
      ? (artists.find((a) => a.id === spotlightProfileId) ?? null)
      : null;

  const gridArtists = spotlightArtist
    ? artists.filter((a) => a.id !== spotlightArtist.id)
    : artists;

  // ── Three tiers below the (single, admin-set) spotlight. A directory is a
  // list, not a mosaic:
  // Directory: everyone presentable (a name or an image) as clean rows.
  // Recently joined: bare signups as mono handles — never fake directory entries.
  // International: anyone based outside NZ/AUS, kept out of the two above so
  // the domestic directory reads as the local scene.
  // Untagged (null country) stays domestic — most bare signups never set one.
  const isInternational = (a: (typeof artists)[number]) =>
    !!a.country && a.country !== "NZ" && a.country !== "AUS";
  const domesticArtists = gridArtists.filter((a) => !isInternational(a));
  const internationalArtists = gridArtists.filter(isInternational);

  const directoryArtists = domesticArtists.filter(isPresentable).sort(byCompleteness);
  const recentlyJoined = domesticArtists.filter((a) => !isPresentable(a));
  const internationalDirectory = internationalArtists.filter(isPresentable).sort(byCompleteness);
  const internationalHandles = internationalArtists.filter((a) => !isPresentable(a));

  // Artists with three works on their profile show them in their row.
  const worksFor = (artist: ProfileWithImage) => {
    const w = worksPreviews[artist.id] ?? [];
    return w.length >= 3 ? w : undefined;
  };

  const badgesFor = (artist: ProfileWithImage) =>
    computeBadges(
      { ...artist, received_grants: (artist as { received_grants?: string[] }).received_grants ?? [] },
      worksCountMap.get(artist.id) ?? 0,
      collectedSet.has(artist.id)
    );

  // Gallery and list are just different card renderings of the same tiered
  // directory (Directory / Recently joined / International) that spotlight
  // view uses — only spotlight additionally gets the hero banner up top.
  const cardView = view === "gallery" ? "gallery" : "list";

  const activeFilters = [
    country,
    career_stage,
    discipline ? `Discipline: ${DISCIPLINE_OPTIONS.find((d) => d.value === discipline)?.label ?? discipline}` : null,
  ].filter(Boolean);

  return (
    <div>
      {/* ══ Page header — title, count, filters ══ */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pt-7 sm:px-6">
          <div className="mb-4 flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">Artists</h1>
            <span className="font-mono text-xs text-muted-foreground">{artists.length}</span>
            {activeFilters.length > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                {activeFilters.join(" · ")}
              </span>
            )}
          </div>

          <Suspense>
            <ArtistFilters />
          </Suspense>
        </div>
      </div>

      {/* ══ Content — on the feed surface ══ */}
      <div className="min-h-screen bg-feed-bg">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
          {/* Spotlight hero — only in spotlight view with no active filters */}
          {spotlightArtist && (
            <div className="relative">
              <ArtistSpotlightHero artist={spotlightArtist} />
              {isAdmin && (
                <div className="absolute right-2 top-2 z-10">
                  <AdminSpotlightMenu
                    profileId={spotlightArtist.id}
                    artistName={spotlightArtist.full_name ?? spotlightArtist.username}
                    isSpotlit
                  />
                </div>
              )}
            </div>
          )}

          {gridArtists.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No artists match those filters.
            </p>
          ) : (
            <>
              {/* Directory — everyone presentable */}
              {directoryArtists.length > 0 && (
                <div className="space-y-3">
                  <p className="t-section-label">Directory</p>
                  <ArtistTier
                    artists={directoryArtists}
                    cardView={cardView}
                    isAdmin={isAdmin}
                    spotlightProfileId={spotlightProfileId}
                    badgesFor={badgesFor}
                    worksFor={worksFor}
                  />
                </div>
              )}

              {/* Recently joined — bare signups as handles, not directory entries */}
              {recentlyJoined.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="t-section-label">Recently joined</p>
                  <HandleChips artists={recentlyJoined} />
                </div>
              )}

              {/* International — artists based outside NZ/AUS */}
              {internationalArtists.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="t-section-label">International</p>
                  {internationalDirectory.length > 0 && (
                    <ArtistTier
                      artists={internationalDirectory}
                      cardView={cardView}
                      isAdmin={isAdmin}
                      spotlightProfileId={spotlightProfileId}
                      badgesFor={badgesFor}
                      worksFor={worksFor}
                    />
                  )}
                  {internationalHandles.length > 0 && (
                    <HandleChips artists={internationalHandles} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
