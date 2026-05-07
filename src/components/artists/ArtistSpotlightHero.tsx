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
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Spotlight · this week
      </p>

      <Link href={href} className="group flex flex-col sm:flex-row border border-black hover:shadow-sm transition-shadow duration-150">
        {/* Image — left, taller than opp hero */}
        <div className="relative sm:w-[55%] h-56 sm:h-72 shrink-0 overflow-hidden bg-stone-100">
          {artist.primary_image_url ? (
            <Image
              src={artist.primary_image_url}
              alt={displayName}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, 55vw"
              priority
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
        <div className="flex-1 border-t border-black sm:border-t-0 sm:border-l border-black p-6 sm:p-8 flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Featured artist
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold leading-tight group-hover:underline underline-offset-2">
              {displayName}
            </h2>
            {location && (
              <p className="text-sm text-muted-foreground mt-1">{location}</p>
            )}
          </div>

          {/* Medium tags */}
          {(artist.medium ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(artist.medium ?? []).slice(0, 5).map((m) => (
                <span key={m} className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1">
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* Bio taster */}
          {artist.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {artist.bio}
            </p>
          )}

          {/* CTA */}
          <div className="mt-auto pt-2">
            <span className="inline-block bg-black text-white text-sm px-5 py-2 group-hover:opacity-80 transition-opacity">
              View profile →
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
