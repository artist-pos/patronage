import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { getProfiles, getProfileById } from "@/lib/profiles";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { createPublicClient } from "@/lib/supabase/public";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import { ArtistSpotlightHero } from "@/components/artists/ArtistSpotlightHero";
import { AdminSpotlightMenu } from "@/components/artists/AdminSpotlightMenu";
import { computeBadges } from "@/lib/badges";
import type { CountryEnum, CareerStageEnum, ProfileWithImage } from "@/types/database";

export const metadata = {
  title: "Artists — Patronage",
  description: "Browse verified New Zealand and Australian artists.",
  alternates: { canonical: "https://patronage.nz/artists" },
};

// ── Cached directory extras — identical for every visitor, revalidated every
// 5 min. Replaces two unbounded full-table artworks fetches per request.
const getCachedDirectoryData = unstable_cache(
  async (today: string) => {
    const supabase = createPublicClient();
    const [collectedResult, worksCountResult, blogSpotlightResult, profileSpotlightResult] =
      await Promise.all([
        // IDs of artists who have had at least one work transferred.
        // PostgREST can't compare two columns in a filter — fetch both and
        // compare in JS (a literal "creator_id" string was a uuid cast error).
        supabase.from("artworks").select("creator_id, current_owner_id"),
        // Works count per artist profile
        supabase.from("artworks").select("profile_id"),
        // Fallback spotlight from blog posts (legacy mechanism)
        supabase
          .from("blog_posts")
          .select("featured_profile_id")
          .eq("status", "published")
          .not("featured_profile_id", "is", null)
          .gte("spotlight_until", today)
          .order("spotlight_until", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Admin-set spotlight (profiles.spotlight_until) — takes precedence
        supabase
          .from("profiles")
          .select("id")
          .gte("spotlight_until", today)
          .order("spotlight_until", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const collectedIds = [...new Set(
      (collectedResult.data ?? [])
        .filter((r: { creator_id: string | null; current_owner_id: string | null }) =>
          r.creator_id && r.current_owner_id && r.current_owner_id !== r.creator_id)
        .map((r: { creator_id: string | null }) => r.creator_id as string)
    )];

    const worksCounts: Record<string, number> = {};
    for (const row of worksCountResult.data ?? []) {
      const r = row as { profile_id: string };
      worksCounts[r.profile_id] = (worksCounts[r.profile_id] ?? 0) + 1;
    }

    return {
      collectedIds,
      worksCounts,
      spotlightProfileId:
        profileSpotlightResult.data?.id ??
        blogSpotlightResult.data?.featured_profile_id ??
        null,
    };
  },
  ["artists-directory-v1"],
  { revalidate: 300, tags: ["artists-directory"] }
);

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string; medium?: string; view?: string; commissions?: string }>;
}

// A single directory row + (for admins) the spotlight menu rail beside it.
// Shared by the Directory and International sections.
function DirectoryRow({
  artist,
  isAdmin,
  spotlightProfileId,
  worksCount,
  collected,
}: {
  artist: ProfileWithImage;
  isAdmin: boolean;
  spotlightProfileId: string | null;
  worksCount: number;
  collected: boolean;
}) {
  return (
    <div className="flex items-stretch">
      <div className="min-w-0 flex-1">
        <ArtistCard
          artist={artist}
          view="list"
          badges={computeBadges(
            { ...artist, received_grants: (artist as { received_grants?: string[] }).received_grants ?? [] },
            worksCount,
            collected
          )}
        />
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

// Bare signups — mono handles, never fake directory entries.
function HandleChips({ artists }: { artists: ProfileWithImage[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {artists.map((artist) => (
        <a
          key={artist.id}
          href={`/${artist.username}`}
          className="border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          @{artist.username}
        </a>
      ))}
    </div>
  );
}

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;
  const medium = params.medium;
  const openForCommissions = params.commissions === "1";
  const view = params.view === "list" ? "list" : params.view === "gallery" ? "gallery" : "spotlight";

  const today = new Date().toISOString().split("T")[0];

  const [artists, { collectedIds, worksCounts, spotlightProfileId }, { user }] = await Promise.all([
    getProfiles({ country, career_stage, medium, openForCommissions }),
    getCachedDirectoryData(today),
    getServerUser(),
  ]);

  const viewerProfile = user ? await getProfileById(user.id) : null;
  const isAdmin = viewerProfile?.role === "admin" || viewerProfile?.role === "owner";

  // Build sets for O(1) lookups
  const collectedSet = new Set(collectedIds);
  const worksCountMap = new Map<string, number>(Object.entries(worksCounts));

  const hasFilters = !!(country || career_stage || medium || openForCommissions);
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
  const completeness = (a: (typeof artists)[number]) => {
    const hasImage = !!(a.primary_image_url || a.avatar_url);
    const hasName = !!a.full_name;
    const hasBio = !!a.bio;
    return { hasImage, hasName, hasBio, score: (hasImage ? 2 : 0) + (hasName ? 2 : 0) + (hasBio ? 1 : 0) };
  };

  // Untagged (null country) stays domestic — most bare signups never set one.
  const isInternational = (a: (typeof artists)[number]) =>
    !!a.country && a.country !== "NZ" && a.country !== "AUS";
  const isPresentable = (a: (typeof artists)[number]) => {
    const c = completeness(a);
    return c.hasName || c.hasImage;
  };
  const byCompleteness = (a: (typeof artists)[number], b: (typeof artists)[number]) =>
    completeness(b).score - completeness(a).score;

  const domesticArtists = gridArtists.filter((a) => !isInternational(a));
  const internationalArtists = gridArtists.filter(isInternational);

  const directoryArtists = domesticArtists.filter(isPresentable).sort(byCompleteness);
  const recentlyJoined = domesticArtists.filter((a) => !isPresentable(a));
  const internationalDirectory = internationalArtists.filter(isPresentable).sort(byCompleteness);
  const internationalHandles = internationalArtists.filter((a) => !isPresentable(a));

  const activeFilters = [
    country,
    career_stage,
    medium ? `Medium: ${medium}` : null,
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
          ) : view === "list" ? (
            <div className="border-t border-border">
              {gridArtists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  view="list"
                  badges={computeBadges(
                    { ...artist, received_grants: (artist as { received_grants?: string[] }).received_grants ?? [] },
                    worksCountMap.get(artist.id) ?? 0,
                    collectedSet.has(artist.id)
                  )}
                />
              ))}
            </div>
          ) : view === "gallery" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {gridArtists.map((artist) => (
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
          ) : (
            <>
              {/* Directory — everyone presentable, as rows */}
              {directoryArtists.length > 0 && (
                <div className="space-y-3">
                  <p className="t-section-label">Directory</p>
                  <div>
                    {directoryArtists.map((artist) => (
                      <DirectoryRow
                        key={artist.id}
                        artist={artist}
                        isAdmin={isAdmin}
                        spotlightProfileId={spotlightProfileId}
                        worksCount={worksCountMap.get(artist.id) ?? 0}
                        collected={collectedSet.has(artist.id)}
                      />
                    ))}
                  </div>
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
                    <div>
                      {internationalDirectory.map((artist) => (
                        <DirectoryRow
                          key={artist.id}
                          artist={artist}
                          isAdmin={isAdmin}
                          spotlightProfileId={spotlightProfileId}
                          worksCount={worksCountMap.get(artist.id) ?? 0}
                          collected={collectedSet.has(artist.id)}
                        />
                      ))}
                    </div>
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
