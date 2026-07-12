import Link from "next/link";
import Image from "next/image";
import type { ProfileWithImage } from "@/types/database";
import type { BadgeSet } from "@/lib/badges";
import { getAvatarGradient, getBannerGradient } from "@/lib/defaults";

function locationLabel(artist: ProfileWithImage & { city?: string | null }): string | null {
  const parts = [artist.city, artist.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

interface Props {
  artist: ProfileWithImage;
  view?: "gallery" | "list" | "portrait";
  compact?: boolean; // fixed 200px height for landing page
  badges?: BadgeSet;
}

/* v2 achievement badges — mono 9px/600, tinted bg, square */
function SecondaryBadges({ badges }: { badges: BadgeSet }) {
  const pills = [
    badges.verified && (["Verified", "badge-verified"] as const),
    badges.exhibited && (["Exhibited", "badge-exhibited"] as const),
    badges.grantRecipient && (["Grant", "badge-grant"] as const),
    badges.collected && (["Collected", "badge-exhibited"] as const),
  ].filter(Boolean) as (readonly [string, string])[];

  if (pills.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {pills.map(([label, cls]) => (
        <span key={label} className={`badge ${cls}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

/* v2 square bordered mono tag */
const TAG_CLS =
  "border border-border px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-[color:var(--fg-muted)] whitespace-nowrap";

/* Green commission-availability status — the artist's status colour */
function CommissionsDot() {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap font-mono text-[10px] text-[color:var(--success)]">
      <span className="h-[5px] w-[5px] rounded-full bg-success" />
      open for commissions
    </span>
  );
}

export function ArtistCard({ artist, view = "gallery", compact = false, badges }: Props) {
  const displayName = artist.full_name ?? artist.username;

  /* ── Portrait card — the Artists canvas format: tall work image, then a
     white info strip. Only used for image-complete (featured) profiles. ── */
  if (view === "portrait") {
    const img = artist.primary_image_url ?? artist.avatar_url;
    return (
      <Link href={`/${artist.username}`} className="pin flex flex-col overflow-hidden bg-card">
        <div className="relative aspect-[4/5] overflow-hidden">
          {img ? (
            <Image
              data-pin-img
              src={img}
              alt={displayName}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-4xl font-semibold text-white/80"
              style={{ background: getBannerGradient(artist.username) }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="px-3.5 pb-3.5 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold leading-tight">{displayName}</span>
            {badges?.verified && <span className="badge badge-verified">Verified</span>}
            {badges?.grantRecipient && <span className="badge badge-grant">Grant</span>}
          </div>
          {(locationLabel(artist) || artist.open_for_commissions) && (
            <div className="mt-1 flex items-center gap-2.5">
              {locationLabel(artist) && (
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {locationLabel(artist)}
                </span>
              )}
              {artist.open_for_commissions && <CommissionsDot />}
            </div>
          )}
          {(artist.medium ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(artist.medium ?? []).slice(0, 2).map((m) => (
                <span key={m} className={`${TAG_CLS} lowercase`}>{m}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
    );
  }

  /* ── List row ── */
  if (view === "list") {
    return (
      <Link
        href={`/${artist.username}`}
        className="group flex items-center gap-4 border-b border-border bg-card px-3 py-3 transition-colors duration-100 hover:bg-muted"
      >
        {/* Avatar */}
        {artist.avatar_url ? (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden">
            <Image
              src={artist.avatar_url}
              alt={displayName}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center text-sm font-semibold text-white/90"
            style={{ background: `linear-gradient(135deg, ${getAvatarGradient(artist.username).from} 0%, ${getAvatarGradient(artist.username).to} 100%)` }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Name + handle */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">
            {displayName}
            {artist.is_patronage_supported && (
              <span className="ml-2 inline-flex bg-foreground px-1.5 py-0.5 align-middle font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                With Patronage
              </span>
            )}
          </p>
          <div className="flex items-center gap-2.5">
            <p className="truncate font-mono text-[11px] text-muted-foreground">@{artist.username}</p>
            {artist.open_for_commissions && <CommissionsDot />}
          </div>
          {badges && <SecondaryBadges badges={badges} />}
        </div>

        {/* Medium tags */}
        <div className="hidden max-w-[40%] shrink-0 flex-wrap justify-end gap-1 sm:flex">
          {(artist.medium ?? []).slice(0, 3).map((m) => (
            <span key={m} className={TAG_CLS}>
              {m}
            </span>
          ))}
        </div>

        {/* Location */}
        {locationLabel(artist) && (
          <span className="hidden shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground md:block">
            {locationLabel(artist)}
          </span>
        )}
      </Link>
    );
  }

  /* ── Compact card (landing-style, side-by-side) ── */
  if (compact) {
    return (
      <Link
        href={`/${artist.username}`}
        className="pin group flex flex-col overflow-hidden bg-card sm:h-[130px] sm:flex-row lg:h-full"
      >
        {/* Image (desktop only) */}
        <div className="relative hidden overflow-hidden sm:block sm:w-1/2">
          {artist.primary_image_url ? (
            <Image
              data-pin-img
              src={artist.primary_image_url}
              alt={displayName}
              fill
              className="object-cover"
              sizes="50vw"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-4xl font-semibold text-white/80"
              style={{ background: getBannerGradient(artist.username) }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2 overflow-hidden bg-card p-3.5 sm:w-1/2">
          <div className="flex items-start gap-2">
            {artist.avatar_url && (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden">
                <Image src={artist.avatar_url} alt={displayName} fill className="object-cover" sizes="40px" />
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-1 pt-1">
              <p className="truncate text-sm font-semibold leading-snug">{displayName}</p>
              {artist.is_patronage_supported && (
                <span className="inline-flex w-fit bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                  With Patronage
                </span>
              )}
              {badges && <SecondaryBadges badges={badges} />}
              {locationLabel(artist) && (
                <span className="font-mono text-[11px] text-muted-foreground">{locationLabel(artist)}</span>
              )}
            </div>
          </div>
          {(artist.medium ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(artist.medium ?? []).slice(0, 2).map((m) => (
                <span key={m} className={TAG_CLS}>{m}</span>
              ))}
            </div>
          ) : artist.career_stage ? (
            <span className={`w-fit ${TAG_CLS}`}>{artist.career_stage}</span>
          ) : null}
        </div>
      </Link>
    );
  }

  /* ── Gallery card — v2: white surface, containerless, image strip left,
     hover dims the image. No borders, no radius, no shadow. ── */
  return (
    <Link
      href={`/${artist.username}`}
      className="pin group flex h-auto flex-row overflow-hidden bg-card sm:h-[154px]"
    >
      {/* Left: image strip — 40% width */}
      <div className="relative w-2/5 shrink-0 overflow-hidden bg-stone-200">
        {artist.primary_image_url ? (
          <Image
            data-pin-img
            src={artist.primary_image_url}
            alt={displayName}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 25vw, 17vw"
          />
        ) : artist.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            data-pin-img
            src={artist.avatar_url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/80"
            style={{ background: getBannerGradient(artist.username) }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Right: info block — 60% width */}
      <div className="flex w-3/5 flex-col gap-2 bg-card py-4 pl-4 pr-3 sm:overflow-hidden">
        <div className="flex items-start gap-2">
          {artist.avatar_url ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden">
              <Image
                src={artist.avatar_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center text-sm font-semibold text-white/90"
              style={{ background: `linear-gradient(135deg, ${getAvatarGradient(artist.username).from} 0%, ${getAvatarGradient(artist.username).to} 100%)` }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <p className="break-words text-[15px] font-semibold leading-snug">{displayName}</p>
            {artist.is_patronage_supported && (
              <span className="inline-flex w-fit bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                With Patronage
              </span>
            )}
            {badges && <SecondaryBadges badges={badges} />}
            {locationLabel(artist) && (
              <span className="truncate font-mono text-[11px] text-muted-foreground">{locationLabel(artist)}</span>
            )}
          </div>
        </div>

        {(artist.medium ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(artist.medium ?? []).slice(0, 3).map((m) => (
              <span key={m} className={TAG_CLS}>
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
