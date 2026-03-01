import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getPortfolioImages } from "@/lib/profiles";
import { Badge } from "@/components/ui/badge";
import { MessageButton } from "@/components/profile/MessageButton";
import type { ExhibitionEntry, BibliographyEntry } from "@/types/database";

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const canMessage = !!user && user.id !== profile.id;

  const images = await getPortfolioImages(profile.id);
  const displayName = profile.full_name ?? profile.username;

  const exhibitions = (profile.exhibition_history ?? []) as ExhibitionEntry[];
  const soloShows = exhibitions.filter((e) => e.type === "Solo").sort((a, b) => b.year - a.year);
  const groupShows = exhibitions.filter((e) => e.type === "Group").sort((a, b) => b.year - a.year);
  const bibliography = (profile.press_bibliography ?? []) as BibliographyEntry[];

  return (
    <div className="max-w-[1600px] mx-auto">

      {/* ── Banner ── */}
      {profile.featured_image_url && (
        <div className="relative w-full aspect-[42/9] overflow-hidden bg-neutral-100">
          <Image
            src={profile.featured_image_url}
            alt={`${displayName} featured work`}
            fill
            priority
            quality={100}
            unoptimized
            className="object-cover"
            style={{ objectPosition: `center ${profile.banner_focus_y ?? 50}%` }}
            sizes="(max-width: 3840px) 100vw, 3840px"
          />
        </div>
      )}

      <div className="px-6 space-y-12">

        {/* ── Identity block — two-column on desktop ── */}
        <div className={profile.featured_image_url ? "-mt-[100px]" : "pt-12"}>
          {/* Avatar */}
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

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">

            {/* Left: name, tags, bio, message */}
            <div className="space-y-3 max-w-3xl">
              <div className="space-y-1">
                <h1 className="text-4xl font-bold tracking-tight">{displayName}</h1>
                {profile.is_patronage_supported && (
                  <Badge className="text-xs font-normal bg-foreground text-background">
                    With Patronage
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

              {profile.bio && (
                <p className="text-base leading-relaxed whitespace-pre-wrap pt-1">{profile.bio}</p>
              )}

              {canMessage && <MessageButton otherUserId={profile.id} />}
            </div>

            {/* Right sidecar: socials + CV link */}
            {(profile.website_url || profile.instagram_handle || profile.cv_url) && (
              <div className="flex flex-col gap-2 lg:text-right lg:items-end shrink-0 pt-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Links
                </p>
                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    {profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
                {profile.instagram_handle && (
                  <a
                    href={`https://instagram.com/${profile.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    @{profile.instagram_handle}
                  </a>
                )}
                {profile.cv_url && (
                  <a
                    href={profile.cv_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
                  >
                    Download CV →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Portfolio ── */}
        {images.length > 0 && (
          <section className="space-y-6 border-t border-border pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Portfolio
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 md:gap-2">
              {images.map((img) => (
                <div key={img.id} className="space-y-1.5">
                  <div className="relative aspect-square border border-border overflow-hidden">
                    <Image
                      src={img.url}
                      alt={img.caption ?? "Portfolio work"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
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

        {/* ── Exhibition History ── */}
        {exhibitions.length > 0 && (
          <section className="space-y-8 border-t border-border pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Exhibition History
            </h2>

            {soloShows.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Solo Exhibitions
                </h3>
                <div className="space-y-1.5">
                  {soloShows.map((ex, i) => (
                    <p key={i} className="text-sm">
                      <span className="font-mono text-muted-foreground">{ex.year}</span>
                      {" — "}
                      <span className="font-semibold">{ex.title}</span>
                      {ex.venue && `, ${ex.venue}`}
                      {ex.location && `, ${ex.location}`}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {groupShows.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Group Exhibitions
                </h3>
                <div className="space-y-1.5">
                  {groupShows.map((ex, i) => (
                    <p key={i} className="text-sm">
                      <span className="font-mono text-muted-foreground">{ex.year}</span>
                      {" — "}
                      <span className="font-semibold">{ex.title}</span>
                      {ex.venue && `, ${ex.venue}`}
                      {ex.location && `, ${ex.location}`}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Selected Bibliography ── */}
        {bibliography.length > 0 && (
          <section className="space-y-6 border-t border-border pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Selected Bibliography
            </h2>
            <div className="space-y-2">
              {bibliography.map((item, i) => (
                <p key={i} className="text-sm leading-relaxed">
                  {item.author && <span>{item.author}. </span>}
                  {item.title && <span>&ldquo;{item.title}.&rdquo; </span>}
                  {item.publication && <span className="italic">{item.publication}</span>}
                  {item.date && <span>, {item.date}</span>}
                  {item.link && (
                    <>
                      {". "}
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
                      >
                        Read →
                      </a>
                    </>
                  )}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* ── Back link ── */}
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
