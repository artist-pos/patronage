import { Suspense } from "react";
import { getProfiles } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import { computeBadges } from "@/lib/badges";
import type { CountryEnum, CareerStageEnum } from "@/types/database";

export const metadata = {
  title: "Artists — Patronage",
  description: "Browse verified New Zealand and Australian artists.",
};

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string; medium?: string; view?: string }>;
}

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;
  const medium = params.medium;
  const view = params.view === "list" ? "list" : "gallery";

  const supabase = await createClient();

  const [artists, collectedResult, worksCountResult] = await Promise.all([
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

  const activeFilters = [
    country,
    career_stage,
    medium ? `Medium: ${medium}` : null,
  ].filter(Boolean);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-8">
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

      {artists.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No artists match the current filters.
        </p>
      ) : view === "list" ? (
        <div className="border-t border-black">
          {artists.map((artist) => (
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
    </div>
  );
}
