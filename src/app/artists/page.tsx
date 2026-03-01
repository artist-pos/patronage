import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { getProfiles } from "@/lib/profiles";
import { Badge } from "@/components/ui/badge";
import { ArtistFilters } from "@/components/artists/ArtistFilters";
import type { CountryEnum, CareerStageEnum, Profile } from "@/types/database";

export const metadata = {
  title: "Artists — Patronage",
  description: "Browse verified New Zealand and Australian artists.",
};

interface PageProps {
  searchParams: Promise<{ country?: string; stage?: string }>;
}

function ArtistCard({ artist }: { artist: Profile }) {
  return (
    <Link
      href={`/${artist.username}`}
      className="group border border-border p-4 flex gap-4 hover:bg-muted/30 transition-colors"
    >
      {artist.avatar_url ? (
        <div className="relative w-12 h-12 shrink-0 border border-border overflow-hidden">
          <Image
            src={artist.avatar_url}
            alt={artist.full_name ?? artist.username}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
      ) : (
        <div className="w-12 h-12 shrink-0 border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
          {(artist.full_name ?? artist.username).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="space-y-1.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium group-hover:underline underline-offset-2">
            {artist.full_name ?? artist.username}
          </p>
          {artist.is_patronage_supported && (
            <Badge className="text-xs font-normal bg-foreground text-background">
              Supported
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {artist.country && (
            <Badge variant="outline" className="text-xs font-normal">
              {artist.country}
            </Badge>
          )}
          {artist.career_stage && (
            <Badge variant="outline" className="text-xs font-normal">
              {artist.career_stage}
            </Badge>
          )}
          {(artist.medium ?? []).slice(0, 3).map((m) => (
            <Badge key={m} variant="outline" className="text-xs font-normal">
              {m}
            </Badge>
          ))}
        </div>
        {artist.bio && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {artist.bio}
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const country = params.country as CountryEnum | undefined;
  const career_stage = params.stage as CareerStageEnum | undefined;

  const artists = await getProfiles({ country, career_stage });

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
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
        <div className="space-y-0 divide-y divide-border">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
}
