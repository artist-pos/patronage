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
import { LazyCreateUpdateModal } from "@/components/feed/LazyCreateUpdateModal";
import { FollowButton } from "@/components/profile/FollowButton";
import { CollectionSection } from "@/components/profile/CollectionSection";
import { LiveOpportunitiesSection } from "@/components/profile/LiveOpportunitiesSection";
import dynamic from "next/dynamic";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { OverviewTab } from "@/components/profile/tabs/OverviewTab";

const WorkTab = dynamic(() =>
  import("@/components/profile/tabs/WorkTab").then((m) => ({ default: m.WorkTab }))
);
const StudioTab = dynamic(() =>
  import("@/components/profile/tabs/StudioTab").then((m) => ({ default: m.StudioTab }))
);
const CvTab = dynamic(() =>
  import("@/components/profile/tabs/CvTab").then((m) => ({ default: m.CvTab }))
);
const SupportTab = dynamic(() =>
  import("@/components/profile/tabs/SupportTab").then((m) => ({ default: m.SupportTab }))
);
import type { ExhibitionEntry, BibliographyEntry, Profile, Opportunity, Artwork, CreativeWork } from "@/types/database";
import { computeBadges } from "@/lib/badges";
import { supabaseTransform } from "@/lib/image";

const VALID_TABS = ["overview", "work", "studio", "cv", "support"] as const;
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
  // Redirect legacy ?tab=press to cv
  const normalised = rawTab === "press" ? "cv" : rawTab;
  const tab: TabType = (VALID_TABS as readonly string[]).includes(normalised ?? "")
    ? (normalised as TabType)
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

  // ── Phase 1: Always-needed (identity block, badges, follow button) ──────────
  const [
    availableWorks,
    portfolioCountResult,
    hasSoldWorkResult,
    alreadyFollowing,
    ownerProjects,
    followsData,
    collectionWorks,
    profileOpportunities,
  ] = await Promise.all([
    // Available works: always needed for "X works available" badge
    isArtistProfile
      ? (() => {
          const q = supabase
            .from("artworks")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("is_available", true);
          return (!isOwner ? q.eq("hide_available", false) : q)
            .order("position", { ascending: true })
            .then(({ data }) => data ?? []);
        })()
      : Promise.resolve([]),
    // Cheap count for portfolio badge when full images not loaded
    isArtistProfile
      ? supabase
          .from("portfolio_images")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profile.id)
          .eq("is_available", false)
          .eq("current_owner_id", profile.id)
      : Promise.resolve({ count: 0 }),
    // Cheap check for "Collected" badge
    isArtistProfile
      ? supabase
          .from("artworks")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", profile.id)
          .neq("current_owner_id", profile.id)
          .limit(1)
      : Promise.resolve({ count: 0 }),
    user && !isOwner ? isFollowing(user.id, profile.id) : Promise.resolve(false),
    // Owner's projects: needed for CreateUpdateModal in identity block
    isOwner && isArtistProfile ? getArtistProjects(profile.id) : Promise.resolve([]),
    // Non-artist: followed artists
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
    // Non-artist: collection
    !isArtistProfile
      ? supabase
          .from("artworks")
          .select("*, creator_profile:creator_id(username, full_name)")
          .eq("current_owner_id", profile.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    // Non-artist: live opportunities
    !isArtistProfile
      ? supabase
          .from("opportunities")
          .select("*")
          .eq("profile_id", profile.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .then(({ data }) => (data ?? []) as Opportunity[])
      : Promise.resolve([] as Opportunity[]),
  ]);

  // ── Phase 2: Tab-conditional fetches ─────────────────────────────────────
  const needsPortfolio = isArtistProfile && (tab === "overview" || tab === "work");
  const needsUpdates   = isArtistProfile && (tab === "overview" || tab === "studio" || tab === "work");
  const needsProjects  = isArtistProfile && (tab === "work" || tab === "studio") && !isOwner;
  const needsSold      = isArtistProfile && tab === "work";
  const needsCreative  = isArtistProfile && (tab === "work" || tab === "studio");

  const [portfolioImages, studioUpdates, tabProjects, soldWorks, creativeWorks] = await Promise.all([
    needsPortfolio
      ? (() => {
          const q = supabase
            .from("portfolio_images")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("is_available", false)
            .eq("current_owner_id", profile.id);
          return (!isOwner ? q.eq("hide_from_archive", false) : q)
            .order("position", { ascending: true })
            .then(({ data }) => data ?? []);
        })()
      : Promise.resolve([]),
    needsUpdates ? getArtistUpdates(profile.id) : Promise.resolve([]),
    needsProjects ? getArtistProjects(profile.id) : Promise.resolve([]),
    needsSold
      ? supabase
          .from("artworks")
          .select("*, owner_profile:current_owner_id(username, full_name)")
          .eq("creator_id", profile.id)
          .neq("current_owner_id", profile.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    needsCreative
      ? supabase
          .from("creative_works")
          .select("*")
          .eq("profile_id", profile.id)
          .order("position", { ascending: true })
          .then(({ data }) => (data ?? []) as CreativeWork[])
      : Promise.resolve([] as CreativeWork[]),
  ]);

  // Merge: owner gets projects from phase 1 (for modal), others from phase 2
  const artistProjects = ownerProjects.length > 0 ? ownerProjects : tabProjects;

  const images = portfolioImages;

  const followingArtists = followsData as Pick<Profile, "id" | "username" | "full_name" | "avatar_url">[];

  // Use full data when loaded; fall back to cheap counts for tabs that skip full fetches
  const portfolioCount = (portfolioCountResult as { count: number | null }).count ?? 0;
  const hasSoldWork = ((hasSoldWorkResult as { count: number | null }).count ?? 0) > 0;
  const isCollected = isArtistProfile && (hasSoldWork || soldWorks.length > 0);
  const imagesCount = images.length > 0 ? images.length : portfolioCount;
  const worksCount = isArtistProfile ? availableWorks.length + imagesCount : 0;
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

  const profileUrl = `https://patronage.nz/${profile.username}`;
  const sameAs = [
    ...(profile.website_url ? [profile.website_url] : []),
    ...(profile.instagram_handle ? [`https://instagram.com/${profile.instagram_handle}`] : []),
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": profileUrl,
        name: displayName,
        url: profileUrl,
        ...(profile.avatar_url && { image: profile.avatar_url }),
        ...(profile.bio && { description: profile.bio }),
        ...(jsonLdDisciplines.length > 0 && {
          jobTitle: jsonLdDisciplines.join(", "),
          knowsAbout: jsonLdDisciplines,
        }),
        ...(profile.country && {
          address: {
            "@type": "PostalAddress",
            addressCountry: profile.country,
          },
        }),
        ...(sameAs.length > 0 && { sameAs }),
      },
      ...(isArtistProfile ? [{
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Artists", item: "https://patronage.nz/artists" },
          { "@type": "ListItem", position: 2, name: displayName, item: profileUrl },
        ],
      }] : []),
    ],
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
        <div
          className="w-full aspect-[42/9]"
          style={{
            backgroundImage: `url("${profile.featured_image_url}")`,
            backgroundSize: "100% auto",
            backgroundRepeat: "no-repeat",
            backgroundPosition: `center ${profile.banner_focus_y ?? 50}%`,
            backgroundColor: "#f5f5f4",
          }}
        />
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

              {isArtistProfile && availableWorks.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <Link
                    href={`/${profile.username}?tab=work`}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    {availableWorks.length} work{availableWorks.length !== 1 ? "s" : ""} available
                  </Link>
                </p>
              )}
            </div>

            {/* Right sidecar: action buttons + links */}
            {(isOwner || canMessage || profile.website_url || profile.instagram_handle || profile.cv_url) && (
              <div className="flex flex-col gap-2 lg:text-right lg:items-end shrink-0 pt-1">
                {isOwner && (
                  <Link
                    href="/profile/edit"
                    className="text-xs border border-border px-3 py-1.5 hover:bg-muted transition-colors self-start lg:self-end"
                  >
                    Edit Profile
                  </Link>
                )}
                {isOwner && isArtistProfile && (
                  <LazyCreateUpdateModal
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
                  username={profile.username}
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
                  bibliography={bibliography}
                  receivedGrants={profile.received_grants ?? []}
                  cvUrl={profile.cv_url}
                  profileId={profile.id}
                  username={profile.username}
                  displayName={displayName}
                  isOwner={isOwner}
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
