import { Suspense } from "react";
import { getProfiles } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import { ArtistSpotlightHero } from "@/components/artists/ArtistSpotlightHero";
import { computeBadges } from "@/lib/badges";
import type { CountryEnum, CareerStageEnum } from "@/types/database";

export const metadata = {
  title: "Artists — Patronage",
  description: "Browse verified New Zealand and Australian artists.",
  alternates: { canonical: "https://patronage.nz/artists" },
};

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string; medium?: string; view?: string }>;
}

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;
  const medium = params.medium;
  const view = params.view === "list" ? "list" : params.view === "gallery" ? "gallery" : "spotlight";

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [artists, collectedResult, worksCountResult, spotlightResult] = await Promise.all([
    getProfiles({ country, career_stage, medium }),
    // IDs of artists who have had at least one work transferred
    supabase
      .from("artworks")
      .select("creator_id")
      .neq("current_owner_id", "creator_id"),
    // Works count per artist profile
    supabase
      .from("artworks")
      .select("profile_id"),
    // Active spotlight from blog posts
    supabase
      .from("blog_posts")
      .select("featured_profile_id")
      .eq("status", "published")
      .not("featured_profile_id", "is", null)
      .gte("spotlight_until", today)
      .order("spotlight_until", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Build sets for O(1) lookups
  const collectedSet = new Set(
    (collectedResult.data ?? [])
      .filter((r: { creator_id: string }) => r.creator_id)
      .map((r: { creator_id: string }) => r.creator_id)
  );

  const worksCountMap = new Map<string, number>();
  for (const row of worksCountResult.data ?? []) {
    const r = row as { profile_id: string };
    worksCountMap.set(r.profile_id, (worksCountMap.get(r.profile_id) ?? 0) + 1);
  }

  const hasFilters = !!(country || career_stage || medium);

  // Spotlight artist — derived from the most recent published blog post with a future spotlight_until date
  const spotlightProfileId = spotlightResult.data?.featured_profile_id ?? null;
  const spotlightArtist =
    view === "spotlight" && !hasFilters && spotlightProfileId
      ? (artists.find((a) => a.id === spotlightProfileId) ?? null)
      : null;

  const gridArtists = spotlightArtist
    ? artists.filter((a) => a.id !== spotlightArtist.id)
    : artists;

  const activeFilters = [
    country,
    career_stage,
    medium ? `Medium: ${medium}` : null,
  ].filter(Boolean);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Artists</h1>
        <p className="text-sm text-muted-foreground">
          {artists.length} artist{artists.length !== 1 ? "s" : ""}
          {activeFilters.length > 0 ? ` · ${activeFilters.join(" · ")}` : ""}
        </p>
      </div>

      <Suspense>
        <ArtistFilters />
      </Suspense>

      {/* Spotlight hero — only in spotlight view with no active filters */}
      {spotlightArtist && (
        <ArtistSpotlightHero artist={spotlightArtist} />
      )}

      {gridArtists.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No artists match those filters.
        </p>
      ) : view === "list" ? (
        <div className="border-t border-black">
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
      ) : (
        <>
          {spotlightArtist && (
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground -mb-4">
              All artists · {gridArtists.length}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </>
      )}
    </div>
  );
}
