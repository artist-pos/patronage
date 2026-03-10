import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { getArtistUpdates } from "@/lib/feed";
import { isFollowing } from "@/lib/follows";
import { getArtistProjects } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { MessageButton } from "@/components/profile/MessageButton";
import { ProfileViewLogger } from "@/components/profile/ProfileViewLogger";
import { TrackedLink } from "@/components/profile/TrackedLink";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";
import { FollowButton } from "@/components/profile/FollowButton";
import { CollectionSection } from "@/components/profile/CollectionSection";
import { LiveOpportunitiesSection } from "@/components/profile/LiveOpportunitiesSection";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { OverviewTab } from "@/components/profile/tabs/OverviewTab";
import { WorkTab } from "@/components/profile/tabs/WorkTab";
import { StudioTab } from "@/components/profile/tabs/StudioTab";
import { CvTab } from "@/components/profile/tabs/CvTab";
import { PressTab } from "@/components/profile/tabs/PressTab";
import { SupportTab } from "@/components/profile/tabs/SupportTab";
import type { ExhibitionEntry, BibliographyEntry, Profile, Opportunity, Artwork, CreativeWork } from "@/types/database";
import { computeBadges } from "@/lib/badges";
import { supabaseTransform } from "@/lib/image";

const VALID_TABS = ["overview", "work", "studio", "cv", "press", "support"] as const;
type TabType = typeof VALID_TABS[number];

const DISCIPLINE_LABELS: Record<string, string> = {
  visual_art: "Visual Art", music: "Music", poetry: "Poetry",
  writing: "Writing", dance: "Dance", film: "Film",
  photography: "Photography", craft: "Craft", performance: "Performance", other: "Other",
};

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Artist not found — Patronage" };

  const displayName = profile.full_name ?? profile.username;

  // Discipline labels for title
  const disciplineLabels = profile.disciplines?.length
    ? profile.disciplines.map((d) => DISCIPLINE_LABELS[d] ?? d)
    : (profile.medium ?? []);
  const disciplineStr = disciplineLabels.join(", ");

  const title = disciplineStr
    ? `${displayName} — ${disciplineStr} | Patronage`
    : `${displayName} | Patronage`;

  // Bio truncated to 155 chars
  const description = profile.bio
    ? profile.bio.length > 155
      ? profile.bio.slice(0, 152) + "…"
      : profile.bio
    : `View ${displayName}'s profile on Patronage.`;

  // OG image: featured banner first, avatar fallback
  const ogImageUrl = profile.featured_image_url ?? profile.avatar_url ?? null;
  const ogImage = ogImageUrl
    ? { url: ogImageUrl, width: 1200, height: 630, alt: `${displayName} — Patronage` }
    : null;

  const profileUrl = `/${username}`;

  return {
    title,
    description,
    alternates: { canonical: profileUrl },
    openGraph: {
      title,
      description,
      url: profileUrl,
      type: "profile",
      ...(ogImage && { images: [ogImage] }),
      ...(profile.full_name && {
        firstName: profile.full_name.split(" ")[0],
        lastName: profile.full_name.split(" ").slice(1).join(" ") || undefined,
      }),
      username,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage && { images: [ogImage.url] }),
    },
  };
}

export default async function ArtistProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: TabType = (VALID_TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as TabType)
    : "overview";

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

  const isArtistProfile = profile.role === "artist" || profile.role === "owner";

  const [portfolioImages, availableWorks, studioUpdates, artistProjects, alreadyFollowing, followsData, soldWorks, collectionWorks, profileOpportunities, creativeWorks] =
    await Promise.all([
      // Bucket A: archival portfolio — not for sale, still owned by the creator
      // Non-owners only see works with hide_from_archive = false
      isArtistProfile
        ? (async () => {
            const q = supabase
              .from("portfolio_images")
              .select("*")
              .eq("profile_id", profile.id)
              .eq("is_available", false)
              .eq("current_owner_id", profile.id);
            const { data } = await (!isOwner ? q.eq("hide_from_archive", false) : q)
              .order("position", { ascending: true });
            return data ?? [];
          })()
        : Promise.resolve([]),
      // Bucket B: available for sale — hide soft-hidden works from non-owners
      isArtistProfile
        ? (async () => {
            const q = supabase
              .from("artworks")
              .select("*")
              .eq("profile_id", profile.id)
              .eq("is_available", true);
            const { data } = await (!isOwner ? q.eq("hide_available", false) : q)
              .order("position", { ascending: true });
            return data ?? [];
          })()
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
      // Bucket C: sold works — transferred to a different owner
      isArtistProfile
        ? supabase
            .from("artworks")
            .select("*, owner_profile:current_owner_id(username, full_name)")
            .eq("creator_id", profile.id)
            .neq("current_owner_id", profile.id)
            .order("created_at", { ascending: false })
            .then(({ data }) => (data ?? []))
        : Promise.resolve([]),
      // Patron/partner collection (works they currently own)
      !isArtistProfile
        ? supabase
            .from("artworks")
            .select("*, creator_profile:creator_id(username, full_name)")
            .eq("current_owner_id", profile.id)
            .order("created_at", { ascending: false })
            .then(({ data }) => (data ?? []))
        : Promise.resolve([]),
      // Patron/partner profile opportunities
      !isArtistProfile
        ? supabase
            .from("opportunities")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .then(({ data }) => (data ?? []) as Opportunity[])
        : Promise.resolve([] as Opportunity[]),
      // Creative works (multi-discipline: images, audio, video, writing)
      isArtistProfile
        ? supabase
            .from("creative_works")
            .select("*")
            .eq("profile_id", profile.id)
            .order("position", { ascending: true })
            .then(({ data }) => (data ?? []) as CreativeWork[])
        : Promise.resolve([] as CreativeWork[]),
    ]);

  const images = portfolioImages;

  // Narrow types for downstream use
  const followingArtists = followsData as Pick<Profile, "id" | "username" | "full_name" | "avatar_url">[];

  // Compute artist badges
  const isCollected = isArtistProfile && soldWorks.length > 0;
  const worksCount = isArtistProfile ? availableWorks.length + images.length : 0;
  const profileBadges = isArtistProfile
    ? computeBadges(
        { ...profile, received_grants: profile.received_grants ?? [] },
        worksCount,
        isCollected
      )
    : null;

  const displayName = profile.full_name ?? profile.username;

  const exhibitions = (profile.exhibition_history ?? []) as ExhibitionEntry[];
  const bibliography = (profile.press_bibliography ?? []) as BibliographyEntry[];

  // Build discipline labels for JSON-LD jobTitle
  const jsonLdDisciplines = profile.disciplines?.length
    ? profile.disciplines.map((d) => DISCIPLINE_LABELS[d] ?? d)
    : (profile.medium ?? []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    url: `https://patronage.nz/${profile.username}`,
    ...(profile.avatar_url && { image: profile.avatar_url }),
    ...(profile.bio && { description: profile.bio }),
    ...(jsonLdDisciplines.length > 0 && {
      jobTitle: jsonLdDisciplines.join(", "),
    }),
    ...(profile.country && {
      address: {
        "@type": "PostalAddress",
        addressCountry: profile.country,
      },
    }),
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileViewLogger profileId={profile.id} username={profile.username} isOwner={isOwner} />

      {/* ── Banner ── */}
      {profile.featured_image_url && (
        <div className="relative w-full aspect-[42/9] overflow-hidden bg-neutral-100">
          <Image
            src={supabaseTransform(profile.featured_image_url, { width: 1600, quality: 85 }) ?? profile.featured_image_url}
            alt={`${displayName} featured work`}
            fill
            priority
            unoptimized
            className="object-cover"
            style={{ objectPosition: `center ${profile.banner_focus_y ?? 50}%` }}
            sizes="100vw"
          />
        </div>
      )}

      <div className="px-4 sm:px-6 space-y-8 sm:space-y-10">

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
                <div className="flex flex-wrap items-center gap-2">
                  {profile.is_patronage_supported && (
                    <Badge className="text-xs font-normal bg-foreground text-background">
                      With Patronage
                    </Badge>
                  )}
                  <Badge className="text-xs font-normal bg-foreground text-background">
                    {profile.role === "owner" ? "Artist" : profile.role === "admin" ? "Admin" : profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </Badge>
                </div>
                {profileBadges && (
                  <div className="flex flex-wrap gap-1.5">
                    {profileBadges.verified && (
                      <span className="text-xs border border-black/50 text-muted-foreground px-1.5 py-0.5 leading-none">Verified</span>
                    )}
                    {profileBadges.exhibited && (
                      <span className="text-xs border border-black/50 text-muted-foreground px-1.5 py-0.5 leading-none">Exhibited</span>
                    )}
                    {profileBadges.grantRecipient && (
                      <span className="text-xs border border-black/50 text-muted-foreground px-1.5 py-0.5 leading-none">Grant Recipient</span>
                    )}
                    {profileBadges.collected && (
                      <span className="text-xs border border-black/50 text-muted-foreground px-1.5 py-0.5 leading-none">Collected</span>
                    )}
                  </div>
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
                {isArtistProfile && (() => {
                  const chips = profile.disciplines?.length
                    ? profile.disciplines.map((d) => DISCIPLINE_LABELS[d] ?? d)
                    : (profile.medium ?? []);
                  return chips.map((label) => (
                    <span key={label} className="text-xs border border-black px-1.5 py-0.5 leading-none">
                      {label}
                    </span>
                  ));
                })()}
              </div>

              {/* Taste chips — patron/partner only */}
              {!isArtistProfile && (profile.medium ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Taste</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile.medium ?? []).map((m) => (
                      <span key={m} className="text-xs border border-black px-1.5 py-0.5 leading-none">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.bio && (
                <p className="text-base leading-relaxed whitespace-pre-wrap pt-1">{profile.bio}</p>
              )}
            </div>

            {/* Right sidecar: action buttons + links */}
            {(isOwner || canMessage || profile.website_url || profile.instagram_handle || profile.cv_url) && (
              <div className="flex flex-col gap-2 lg:text-right lg:items-end shrink-0 pt-1">
                {isOwner && isArtistProfile && (
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

        {/* ── Artist profile: tabbed layout ── */}
        {isArtistProfile && (
          <>
            <ProfileTabs username={profile.username} tab={tab} />

            <div>
              {tab === "overview" && (
                <OverviewTab
                  exhibitions={exhibitions}
                  bibliography={bibliography}
                  receivedGrants={profile.received_grants ?? []}
                  portfolioImages={images}
                  studioUpdates={studioUpdates}
                  artistName={displayName}
                  viewerRole={viewerRole}
                  username={profile.username}
                  profileId={isOwner ? undefined : profile.id}
                />
              )}

              {tab === "work" && (
                <WorkTab
                  portfolioImages={images}
                  availableWorks={availableWorks}
                  soldWorks={soldWorks as (Artwork & { owner_profile: { username: string; full_name: string | null } | null })[]}
                  projects={artistProjects}
                  studioUpdates={studioUpdates}
                  profileId={profile.id}
                  artistName={displayName}
                  viewerRole={viewerRole}
                  isOwner={isOwner}
                  hideSoldSection={profile.hide_sold_section}
                  displayName={displayName}
                />
              )}

              {tab === "studio" && (
                <StudioTab
                  updates={studioUpdates}
                  artistUsername={profile.username}
                  isOwner={isOwner}
                  projects={artistProjects}
                  profileId={profile.id}
                  creativeWorks={creativeWorks}
                />
              )}

              {tab === "cv" && (
                <CvTab
                  exhibitions={exhibitions}
                  receivedGrants={profile.received_grants ?? []}
                  cvUrl={profile.cv_url}
                  profileId={profile.id}
                  username={profile.username}
                  displayName={displayName}
                />
              )}

              {tab === "press" && (
                <PressTab
                  bibliography={bibliography}
                  profileId={profile.id}
                  username={profile.username}
                />
              )}

              {tab === "support" && (
                <SupportTab
                  supportEnabled={profile.support_enabled}
                  isOwner={isOwner}
                  artistName={displayName}
                />
              )}
            </div>
          </>
        )}

        {/* ── Patron / Partner sections (flat layout) ── */}
        {!isArtistProfile && (
          <>
            {/* 1. Live Opportunities — top */}
            <LiveOpportunitiesSection
              initialOpportunities={profileOpportunities}
              isOwner={isOwner}
            />

            {/* 2. Artists I Follow */}
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

            {/* 3. Collection */}
            <CollectionSection
              initialWorks={collectionWorks as (Artwork & { creator_profile: { username: string; full_name: string | null } | null })[]}
              isOwner={isOwner}
              collectionPublic={profile.collection_public ?? true}
            />
          </>
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
