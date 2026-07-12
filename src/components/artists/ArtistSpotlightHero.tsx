import Link from "next/link";
import Image from "next/image";
import type { ProfileWithImage } from "@/types/database";

interface Props {
  artist: ProfileWithImage;
}

export function ArtistSpotlightHero({ artist }: Props) {
  const displayName = artist.full_name ?? artist.username;
  const location = [artist.city, artist.country].filter(Boolean).join(", ");
  const href = `/${artist.username}`;

  return (
    <section className="space-y-3">
      <p className="t-section-label">Spotlight · this week</p>

      <Link href={href} className="pin group flex flex-col bg-card sm:flex-row">
        {/* Image — left, stretches to match content panel height on desktop */}
        <div className="relative h-56 shrink-0 overflow-hidden bg-stone-200 sm:h-auto sm:min-h-72 sm:w-[55%]">
          {artist.primary_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-pin-img
              src={artist.primary_image_url}
              alt={displayName}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : artist.avatar_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artist.avatar_url}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover scale-110"
                style={{ filter: "blur(24px) brightness(0.6)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/50">
                  <Image src={artist.avatar_url} alt={displayName} fill className="object-cover" sizes="96px" />
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-200 text-5xl font-medium text-stone-400">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content — right */}
        <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
          <div>
            <p className="t-section-label mb-3">Featured artist</p>
            <h2 className="text-2xl font-semibold leading-tight tracking-[-0.022em] sm:text-3xl">
              {displayName}
            </h2>
            {location && (
              <p className="mt-1.5 font-mono text-xs text-muted-foreground">{location}</p>
            )}
          </div>

          {/* Medium tags */}
          {(artist.medium ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(artist.medium ?? []).slice(0, 5).map((m) => (
                <span key={m} className="border border-border px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-[color:var(--fg-muted)]">
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* Bio taster */}
          {artist.bio && (
            <p className="line-clamp-3 text-sm leading-[1.65] text-muted-foreground">
              {artist.bio}
            </p>
          )}

          {/* CTA */}
          <div className="mt-auto border-t border-border pt-4 font-mono text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
            View profile →
          </div>
        </div>
      </Link>
    </section>
  );
}
