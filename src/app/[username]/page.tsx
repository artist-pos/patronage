import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getProfile, getPortfolioImages } from "@/lib/profiles";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Artist not found — Patronage" };
  return {
    title: `${profile.full_name ?? profile.username} — Patronage`,
    description: profile.bio ?? undefined,
  };
}

export default async function ArtistProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const images = await getPortfolioImages(profile.id);
  const displayName = profile.full_name ?? profile.username;

  return (
    <div className="max-w-[1600px] mx-auto">

      {/* ── Featured image banner (full-bleed, ~50% shorter) ── */}
      {profile.featured_image_url && (
        <div className="relative w-full aspect-[42/9] overflow-hidden">
          <Image
            src={profile.featured_image_url}
            alt={`${displayName} featured work`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        </div>
      )}

      <div className="px-6 space-y-12">

        {/* ── Identity block ── */}
        <div className={profile.featured_image_url ? "-mt-[100px]" : "pt-12"}>
          {/* Avatar — 200×200px, overlaps banner */}
          {profile.avatar_url && (
            <div className="relative w-[200px] h-[200px] shrink-0 border-2 border-background overflow-hidden bg-background outline outline-1 outline-black z-10 mb-4">
              <Image
                src={profile.avatar_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="200px"
              />
            </div>
          )}

          {/* Stacked info: Name → Badge → Handle → Tags */}
          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight">{displayName}</h1>
              {profile.is_patronage_supported && (
                <Badge className="text-xs font-normal bg-foreground text-background">
                  Patronage Supported
                </Badge>
              )}
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {profile.country && (
                <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
                  {profile.country}
                </span>
              )}
              {profile.career_stage && (
                <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
                  {profile.career_stage}
                </span>
              )}
              {(profile.medium ?? []).map((m) => (
                <span key={m} className="text-xs border border-black px-1.5 py-0.5 leading-none">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bio ── */}
        {profile.bio && (
          <section>
            <p className="text-base leading-relaxed whitespace-pre-wrap max-w-2xl">{profile.bio}</p>
          </section>
        )}

        {/* ── Social links ── */}
        {(profile.website_url || profile.instagram_handle) && (
          <section className="flex flex-wrap gap-4">
            {profile.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base underline underline-offset-2 hover:text-muted-foreground transition-colors"
              >
                {profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base underline underline-offset-2 hover:text-muted-foreground transition-colors"
              >
                @{profile.instagram_handle}
              </a>
            )}
          </section>
        )}

        {/* ── Portfolio ── */}
        {images.length > 0 && (
          <section className="space-y-6 border-t border-border pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Portfolio
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {images.map((img) => (
                <div key={img.id} className="space-y-1.5">
                  <div className="relative aspect-square border border-border overflow-hidden">
                    <Image
                      src={img.url}
                      alt={img.caption ?? "Portfolio work"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  </div>
                  {img.caption && (
                    <p className="text-xs text-muted-foreground leading-snug font-mono">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── CV ── */}
        {profile.cv_url && (
          <section className="border-t border-border pt-10">
            <a
              href={profile.cv_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
            >
              Download CV (PDF) →
            </a>
          </section>
        )}

        <div className="border-t border-border pt-6 pb-12">
          <Link
            href="/artists"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to artists
          </Link>
        </div>
      </div>
    </div>
  );
}
