import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ProfileWithImage } from "@/types/database";

interface Props {
  artist: ProfileWithImage;
  view?: "gallery" | "list";
  compact?: boolean; // fixed 200px height for landing page
}

export function ArtistCard({ artist, view = "gallery", compact = false }: Props) {
  const displayName = artist.full_name ?? artist.username;
  const bioTaster = artist.bio
    ? artist.bio.slice(0, 120) + (artist.bio.length > 120 ? "…" : "")
    : null;

  /* ── List row ── */
  if (view === "list") {
    return (
      <Link
        href={`/${artist.username}`}
        className="group flex items-center gap-4 border-b border-black py-3 px-2 hover:bg-muted/30 transition-colors"
      >
        {/* Avatar */}
        {artist.avatar_url ? (
          <div className="relative w-10 h-10 shrink-0 border border-black overflow-hidden">
            <Image
              src={artist.avatar_url}
              alt={displayName}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="w-10 h-10 shrink-0 border border-black bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Name + handle */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug truncate">
            {displayName}
            {artist.is_patronage_supported && (
              <Badge className="ml-2 text-xs font-normal bg-foreground text-background align-middle">
                With Patronage
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">@{artist.username}</p>
        </div>

        {/* Medium tags */}
        <div className="hidden sm:flex flex-wrap gap-1 justify-end shrink-0 max-w-[40%]">
          {(artist.medium ?? []).slice(0, 3).map((m) => (
            <span key={m} className="text-xs border border-black px-1.5 py-0.5 leading-none whitespace-nowrap">
              {m}
            </span>
          ))}
        </div>

        {/* Country */}
        {artist.country && (
          <span className="hidden md:block text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {artist.country}
          </span>
        )}
      </Link>
    );
  }

  /* ── Gallery card ── */
  return (
    <Link
      href={`/${artist.username}`}
      className={`group flex flex-col sm:flex-row border border-black ${compact ? "sm:h-[200px]" : "min-h-[320px]"}`}
    >
      {/* Left – featured image */}
      <div className={`relative sm:aspect-auto shrink-0 overflow-hidden ${compact ? "hidden sm:block sm:w-1/2" : "aspect-[4/3] sm:w-3/5"}`}>
        {artist.primary_image_url ? (
          <Image
            src={artist.primary_image_url}
            alt={displayName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes={compact ? "50vw" : "(max-width: 640px) 100vw, 60vw"}
          />
        ) : (
          <div className="absolute inset-0 bg-muted flex items-center justify-center text-4xl text-muted-foreground font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Right – metadata */}
      <div className={`bg-white border-t border-black sm:border-t-0 sm:border-l flex flex-col overflow-hidden ${compact ? "sm:w-1/2 p-4 gap-2" : "sm:w-2/5 p-5 pb-6 gap-3"}`}>

        {/* Avatar + name/badge */}
        <div className="flex items-start gap-3">
          {artist.avatar_url && (
            <div className={`relative shrink-0 border border-black overflow-hidden ${compact ? "w-[100px] h-[100px]" : "w-[100px] h-[100px]"}`}>
              <Image
                src={artist.avatar_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="100px"
              />
            </div>
          )}
          <div className="flex flex-col gap-1 pt-1 min-w-0">
            <p className="font-bold leading-snug truncate">{displayName}</p>
            {artist.is_patronage_supported && (
              <Badge className="text-xs font-normal bg-foreground text-background w-fit">
                With Patronage
              </Badge>
            )}
            {artist.country && (
              <span className="text-xs text-muted-foreground">{artist.country}</span>
            )}
          </div>
        </div>

        {!compact && bioTaster && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {bioTaster}
          </p>
        )}

        {(artist.medium ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(compact ? (artist.medium ?? []).slice(0, 2) : (artist.medium ?? [])).map((m) => (
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
