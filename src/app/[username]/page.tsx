import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getPortfolioImages } from "@/lib/profiles";
import { getArtistUpdates } from "@/lib/feed";
import { isFollowing } from "@/lib/follows";
import { getArtistProjects } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { MessageButton } from "@/components/profile/MessageButton";
import { ProfileViewLogger } from "@/components/profile/ProfileViewLogger";
import { TrackedLink } from "@/components/profile/TrackedLink";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";
import { StudioCarousel } from "@/components/profile/StudioCarousel";
import { FollowButton } from "@/components/profile/FollowButton";
import { PortfolioGrid } from "@/components/profile/PortfolioGrid";
import { AvailableWorkCard } from "@/components/profile/AvailableWorkCard";
import type { ExhibitionEntry, BibliographyEntry, Profile } from "@/types/database";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Artist not found — Patronage" };

  const displayName = profile.full_name ?? profile.username;
  const description = profile.bio
    ? profile.bio.slice(0, 160)
    : `View ${displayName}'s artist portfolio on Patronage.`;

  return {
    title: `${displayName} | Artist Portfolio | Patronage`,
    description,
    openGraph: {
      title: `${displayName} | Artist Portfolio | Patronage`,
      description,
      ...(profile.featured_image_url && {
        images: [
          {
            url: profile.featured_image_url,
            width: 3840,
            height: 823,
            alt: `${displayName} featured artwork`,
          },
        ],
      }),
    },
  };
}

export default async function ArtistProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const canMessage = !!user && user.id !== profile.id;
  const isOwner = !!user && user.id === profile.id;

  // Fetch current viewer's role for conditional UI (e.g. "Enquire to Buy")
  let viewerRole: string | null = null;
  if (user && !isOwner) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    viewerRole = viewerProfile?.role ?? null;
  }

  const isArtistProfile = profile.role === "artist";

  const [images, availableWorks, studioUpdates, artistProjects, alreadyFollowing, followsData] =
    await Promise.all([
      isArtistProfile ? getPortfolioImages(profile.id) : Promise.resolve([]),
      isArtistProfile
        ? supabase
            .from("portfolio_images")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("is_available", true)
            .order("position", { ascending: true })
            .then(({ data }) => (data ?? []))
        : Promise.resolve([]),
      isArtistProfile ? getArtistUpdates(profile.id) : Promise.resolve([]),
      isArtistProfile ? getArtistProjects(profile.id) : Promise.resolve([]),
      user && !isOwner ? isFollowing(user.id, profile.id) : Promise.resolve(false),
      // For patron/partner profiles: get the artists they follow
      !isArtistProfile
        ? supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", profile.id)
            .then(async ({ data: follows }) => {
              const ids = (follows ?? []).map((f: { following_id: string }) => f.following_id);
              if (ids.length === 0) return [];
              const { data: artists } = await supabase
                .from("profiles")
                .select("id, username, full_name, avatar_url")
                .in("id", ids);
              return (artists ?? []) as Pick<Profile, "id" | "username" | "full_name" | "avatar_url">[];
            })
        : Promise.resolve([]),
    ]);

  // Narrow types for downstream use
  const followingArtists = followsData as Pick<Profile, "id" | "username" | "full_name" | "avatar_url">[];

  const displayName = profile.full_name ?? profile.username;

  const exhibitions = (profile.exhibition_history ?? []) as ExhibitionEntry[];
  const soloShows = exhibitions.filter((e) => e.type === "Solo").sort((a, b) => b.year - a.year);
  const groupShows = exhibitions.filter((e) => e.type === "Group").sort((a, b) => b.year - a.year);
  const bibliography = (profile.press_bibliography ?? []) as BibliographyEntry[];

  return (
    <div className="max-w-[1600px] mx-auto">
      <ProfileViewLogger profileId={profile.id} username={profile.username} isOwner={isOwner} />

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

      <div className="px-4 sm:px-6 space-y-8 sm:space-y-12">

        {/* ── Identity block ── */}
        <div className={profile.featured_image_url ? "-mt-[60px] sm:-mt-[100px]" : "pt-8 sm:pt-12"}>
          {profile.avatar_url && (
            <div className="relative w-[120px] h-[120px] sm:w-[200px] sm:h-[200px] shrink-0 border-2 border-background overflow-hidden bg-background outline outline-1 outline-black z-10 mb-4">
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

            {/* Left: name, tags, bio, actions */}
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
            </div>

            {/* Right sidecar: action buttons + links */}
            {(isOwner || canMessage || profile.website_url || profile.instagram_handle || profile.cv_url) && (
              <div className="flex flex-col gap-2 lg:text-right lg:items-end shrink-0 pt-1">
                {isOwner && (
                  <CreateUpdateModal
                    profileId={profile.id}
                    label="Post a studio update +"
                    projects={artistProjects.map((p) => ({ id: p.id, title: p.title }))}
                  />
                )}
                {canMessage && (
                  <div className="flex items-center gap-2">
                    <FollowButton followingId={profile.id} initialIsFollowing={alreadyFollowing} />
                    <MessageButton otherUserId={profile.id} />
                  </div>
                )}
                {(profile.website_url || profile.instagram_handle || profile.cv_url) && (
                  <div className="flex flex-col gap-2 lg:items-end mt-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      Links
                    </p>
                    {profile.website_url && (
                      <TrackedLink
                        href={profile.website_url}
                        profileId={profile.id}
                        username={profile.username}
                        eventType="website_click"
                        className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
                      >
                        {profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </TrackedLink>
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
                      <TrackedLink
                        href={profile.cv_url}
                        profileId={profile.id}
                        username={profile.username}
                        eventType="cv_click"
                        className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
                      >
                        Download CV →
                      </TrackedLink>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Selected Bibliography — immediately below bio ── */}
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
                      <TrackedLink
                        href={item.link}
                        profileId={profile.id}
                        username={profile.username}
                        eventType="bib_click"
                        className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
                      >
                        Read →
                      </TrackedLink>
                    </>
                  )}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* ── Artist-only sections ── */}
        {isArtistProfile && (
          <>
            {/* Portfolio */}
            {images.length > 0 && (
              <section className="space-y-6 border-t border-border pt-10">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Portfolio
                </h2>
                <PortfolioGrid images={images} />
              </section>
            )}

            {/* Available Works */}
            {availableWorks.length > 0 && (
              <section className="space-y-4 border-t border-border pt-10">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Available Works
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none items-start">
                  {availableWorks.map((img) => (
                    <AvailableWorkCard
                      key={img.id}
                      img={img}
                      artistId={profile.id}
                      artistName={profile.full_name ?? profile.username}
                      viewerRole={viewerRole}
                      isOwner={isOwner}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Studio Updates Carousel */}
            <StudioCarousel
              updates={studioUpdates}
              artistUsername={profile.username}
              isOwner={isOwner}
              profileId={profile.id}
              projects={artistProjects.map((p) => ({ id: p.id, title: p.title }))}
            />
          </>
        )}

        {/* ── Patron / Partner "Taste" sections ── */}
        {!isArtistProfile && (
          <>
            {/* Artists I Follow */}
            <section className="space-y-4 border-t border-border pt-10">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Artists I Follow
              </h2>
              {followingArtists.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not following anyone yet.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {followingArtists.map((a) => (
                    <Link
                      key={a.id}
                      href={`/${a.username}`}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className="relative w-14 h-14 border border-black overflow-hidden bg-muted">
                        {a.avatar_url ? (
                          <Image
                            src={a.avatar_url}
                            alt={a.full_name ?? a.username}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-lg font-medium text-muted-foreground">
                            {(a.full_name ?? a.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">
                        {a.full_name ?? a.username}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Collection */}
            <section className="space-y-4 border-t border-border pt-10">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Collection
              </h2>
              <p className="text-sm text-muted-foreground">No works collected yet.</p>
            </section>
          </>
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
