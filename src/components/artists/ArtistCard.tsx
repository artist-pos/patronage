import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ProfileWithImage } from "@/types/database";
import type { BadgeSet } from "@/lib/badges";

interface Props {
  artist: ProfileWithImage;
  view?: "gallery" | "list";
  compact?: boolean; // fixed 200px height for landing page
  badges?: BadgeSet;
}

function SecondaryBadges({ badges }: { badges: BadgeSet }) {
  const pills = [
    badges.verified && "Verified",
    badges.exhibited && "Exhibited",
    badges.grantRecipient && "Grant Recipient",
    badges.collected && "Collected",
  ].filter(Boolean) as string[];

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {pills.map((label) => (
        <span
          key={label}
          className="text-[10px] border border-black/50 text-muted-foreground px-1.5 py-0.5 leading-none"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function ArtistCard({ artist, view = "gallery", compact = false, badges }: Props) {
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
          {badges && <SecondaryBadges badges={badges} />}
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

  /* ── Compact card (homepage landing, side-by-side) ── */
  if (compact) {
    return (
      <Link
        href={`/${artist.username}`}
        className="group flex flex-col sm:flex-row border border-black sm:h-[200px]"
      >
        {/* Image (desktop only) */}
        <div className="relative hidden sm:block sm:w-1/2 overflow-hidden">
          {artist.primary_image_url ? (
            <Image
              src={artist.primary_image_url}
              alt={displayName}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="50vw"
            />
          ) : (
            <div className="absolute inset-0 bg-muted flex items-center justify-center text-4xl text-muted-foreground font-medium">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-white border-t border-black sm:border-t-0 sm:border-l flex flex-col overflow-hidden sm:w-1/2 p-4 gap-2">
          <div className="flex items-start gap-3">
            {artist.avatar_url && (
              <div className="relative w-20 h-20 shrink-0 border border-black overflow-hidden">
                <Image src={artist.avatar_url} alt={displayName} fill className="object-cover" sizes="80px" />
              </div>
            )}
            <div className="flex flex-col gap-1 pt-1 min-w-0">
              <p className="font-bold leading-snug truncate">{displayName}</p>
              {artist.is_patronage_supported && (
                <Badge className="text-xs font-normal bg-foreground text-background w-fit">With Patronage</Badge>
              )}
              {badges && <SecondaryBadges badges={badges} />}
              {artist.country && <span className="text-xs text-muted-foreground">{artist.country}</span>}
            </div>
          </div>
          {(artist.medium ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(artist.medium ?? []).slice(0, 2).map((m) => (
                <span key={m} className="text-xs border border-black px-1.5 py-0.5 leading-none">{m}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
    );
  }

  /* ── Gallery card — horizontal bar, avatar inside info block ── */
  return (
    <Link
      href={`/${artist.username}`}
      className="group flex flex-row border border-black h-[154px]"
    >
      {/* Left: image strip — 40% width */}
      <div className="relative w-2/5 shrink-0 overflow-hidden bg-muted">
        {artist.primary_image_url ? (
          <Image
            src={artist.primary_image_url}
            alt={displayName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 1024px) 25vw, 17vw"
          />
        ) : (
          <div className="absolute inset-0 bg-muted flex items-center justify-center text-2xl text-muted-foreground font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Right: info block — 60% width, 12px left padding */}
      <div className="bg-white border-l border-black flex flex-col w-3/5 pl-3 pr-2 py-3 gap-2 overflow-hidden">
        <div className="flex items-start gap-2">
          {artist.avatar_url && (
            <div className="relative w-10 h-10 shrink-0 border border-black overflow-hidden">
              <Image
                src={artist.avatar_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
          )}
          <div className="flex flex-col gap-1 pt-1 min-w-0">
            <p className="font-bold leading-snug break-words text-sm">{displayName}</p>
            {artist.is_patronage_supported && (
              <Badge className="text-xs font-normal bg-foreground text-background w-fit">
                With Patronage
              </Badge>
            )}
            {badges && <SecondaryBadges badges={badges} />}
            {artist.country && (
              <span className="text-xs text-muted-foreground truncate">{artist.country}</span>
            )}
          </div>
        </div>

        {(artist.medium ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(artist.medium ?? []).slice(0, 3).map((m) => (
              <span key={m} className="text-xs border border-black px-1.5 py-0.5 leading-none">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
