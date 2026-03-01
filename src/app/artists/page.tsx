import { Suspense } from "react";
import { getProfiles } from "@/lib/profiles";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import type { CountryEnum, CareerStageEnum } from "@/types/database";

export const metadata = {
  title: "Artists — Patronage",
  description: "Browse verified New Zealand and Australian artists.",
};

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string }>;
}

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;

  const artists = await getProfiles({ country, career_stage });

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Artists</h1>
        <p className="text-sm text-muted-foreground">
          {artists.length} artist{artists.length !== 1 ? "s" : ""}
          {country || career_stage
            ? ` · filtered by${country ? ` ${country}` : ""}${career_stage ? ` · ${career_stage}` : ""}`
            : ""}
        </p>
      </div>

      <Suspense>
        <ArtistFilters />
      </Suspense>

      {artists.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No artists match the current filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
}
