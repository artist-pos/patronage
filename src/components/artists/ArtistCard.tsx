import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ProfileWithImage } from "@/types/database";

export function ArtistCard({ artist }: { artist: ProfileWithImage }) {
  const displayName = artist.full_name ?? artist.username;
  const bioTaster = artist.bio
    ? artist.bio.slice(0, 120) + (artist.bio.length > 120 ? "…" : "")
    : null;

  return (
    <Link
      href={`/${artist.username}`}
      className="group flex flex-col sm:flex-row border border-black overflow-hidden min-h-[250px]"
    >
      {/* Left – featured image, fills full card height */}
      <div className="relative aspect-[4/3] sm:aspect-auto sm:w-3/5 shrink-0 overflow-hidden">
        {artist.primary_image_url ? (
          <Image
            src={artist.primary_image_url}
            alt={displayName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 60vw"
          />
        ) : (
          <div className="absolute inset-0 bg-muted flex items-center justify-center text-4xl text-muted-foreground font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Right – metadata, 1px black left border */}
      <div className="sm:w-2/5 bg-white border-t border-black sm:border-t-0 sm:border-l p-5 flex flex-col gap-3">

        {/* Name row — avatar immediately left of name */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {artist.avatar_url && (
            <div className="relative w-8 h-8 shrink-0 border border-black overflow-hidden">
              <Image
                src={artist.avatar_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
          )}
          <p className="font-bold leading-snug">{displayName}</p>
          {artist.is_patronage_supported && (
            <Badge className="text-xs font-normal bg-foreground text-background">
              Supported
            </Badge>
          )}
        </div>

        {bioTaster && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {bioTaster}
          </p>
        )}

        {(artist.medium ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
            {(artist.medium ?? []).map((m) => (
              <span
                key={m}
                className="text-xs border border-black px-1.5 py-0.5 leading-none"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
