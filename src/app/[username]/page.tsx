import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { isProfileComplete } from "@/lib/profile-completion";
import { getArtistUpdates } from "@/lib/feed";
import { isFollowing } from "@/lib/follows";
import { getArtistProjects } from "@/lib/projects";
import { Globe, Instagram } from "lucide-react";
import { MessageButton } from "@/components/profile/MessageButton";
import { ProfileViewLogger } from "@/components/profile/ProfileViewLogger";
import { TrackedLink } from "@/components/profile/TrackedLink";
import { LazyCreateUpdateModal } from "@/components/feed/LazyCreateUpdateModal";
import { FollowButton } from "@/components/profile/FollowButton";
import { CollectionSection } from "@/components/profile/CollectionSection";
import { LiveOpportunitiesSection } from "@/components/profile/LiveOpportunitiesSection";
import type { CampaignForProfile } from "@/components/profile/CampaignsSection";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import dynamic from "next/dynamic";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { OverviewTab } from "@/components/profile/tabs/OverviewTab";

const WorksJustifiedGrid = dynamic(() =>
  import("@/components/feed/WorksJustifiedGrid").then((m) => ({ default: m.WorksJustifiedGrid }))
);

const WorkTab = dynamic(() =>
  import("@/components/profile/tabs/WorkTab").then((m) => ({ default: m.WorkTab }))
);
const CvTab = dynamic(() =>
  import("@/components/profile/tabs/CvTab").then((m) => ({ default: m.CvTab }))
);
const SupportTab = dynamic(() =>
  import("@/components/profile/tabs/SupportTab").then((m) => ({ default: m.SupportTab }))
);
import type { ExhibitionEntry, BibliographyEntry, Profile, Opportunity, Artwork, CreativeWork, ProfileAchievement, SupportTier, PortfolioImage } from "@/types/database";
import type { ArtworkForGrid, EditionOption } from "@/components/feed/WorksJustifiedGrid";
import { computeBadges } from "@/lib/badges";
import { supabaseTransform } from "@/lib/image";
import { getAvatarGradient, getBannerGradient } from "@/lib/defaults";
import { HideBlogCardToggle } from "@/components/profile/HideBlogCardToggle";

const VALID_TABS = ["overview", "work", "cv", "support"] as const;
type TabType = typeof VALID_TABS[number];

const DISCIPLINE_LABELS: Record<string, string> = {
  visual_art: "Visual Art", music: "Music", poetry: "Poetry",
  writing: "Writing", dance: "Dance", film: "Film",
  photography: "Photography", craft: "Craft", performance: "Performance", other: "Other",
};

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; ptab?: string }>;
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

  // Bio truncated to 155 chars; fallback builds a keyword-rich sentence from available data
  const description = profile.bio
    ? profile.bio.length > 155
      ? profile.bio.slice(0, 152) + "…"
      : profile.bio
    : disciplineStr && profile.country
      ? `${displayName} is a ${disciplineStr} based in ${profile.country}. View portfolio, studio updates, and CV on Patronage.`
      : disciplineStr
        ? `${displayName} is a ${disciplineStr}. View portfolio, studio updates, and CV on Patronage.`
        : `View ${displayName}'s portfolio, studio updates, and CV on Patronage.`;

  // OG image: featured banner first, avatar fallback
  const ogImageUrl = profile.featured_image_url ?? profile.avatar_url ?? null;
  const ogImage = ogImageUrl
    ? { url: ogImageUrl, width: 1200, height: 630, alt: `${displayName} — Patronage` }
    : null;

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const profileUrl = `${BASE_URL}/${username}`;

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
  const { tab: rawTab, ptab: rawPtab } = await searchParams;
  const patronTab = rawPtab === "collection" ? "collection" : "overview";
  // Redirect legacy ?tab=press → cv, ?tab=studio → work
  const normalised = rawTab === "press" ? "cv" : rawTab === "studio" ? "work" : rawTab;
  const tab: TabType = (VALID_TABS as readonly string[]).includes(normalised ?? "")
    ? (normalised as TabType)
    : "overview";

  const [profile, supabase] = await Promise.all([
    getProfile(username),
    createClient(),
  ]);
  if (!profile) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const canMessage = !!user && user.id !== profile.id;
  const isOwner = !!user && user.id === profile.id;

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
    profileCampaigns,
    viewerRoleResult,
    sharePortfolioImages,
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
          .from("artworks")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profile.id)
          .eq("creator_id", profile.id)
          .eq("current_owner_id", profile.id)
          .eq("hide_from_archive", false)
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
          .select("*, creator_profile:creator_id(username, full_name, avatar_url)")
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
    // Artist: public campaigns (selected for opportunities)
    isArtistProfile
      ? supabase
          .from("campaigns")
          .select("id, title, slug, landing_page_slug, campaign_start_date, campaign_end_date, location_address, landing_page_config")
          .eq("artist_profile_id", profile.id)
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .then(({ data }) => data ?? [])
      : Promise.resolve([] as unknown[]),
    // Viewer role for conditional UI — folded into Phase 1 to avoid sequential step
    user && !isOwner
      ? supabase.from("profiles").select("role").eq("id", user.id).single().then(r => r.data?.role ?? null)
      : Promise.resolve(null as string | null),
    // Portfolio images for share picker (artist's own works, any availability, position-ordered)
    isArtistProfile
      ? supabase
          .from("artworks")
          .select("id, url")
          .eq("creator_id", profile.id)
          .eq("current_owner_id", profile.id)
          .eq("hide_from_archive", false)
          .not("url", "is", null)
          .order("position", { ascending: true })
          .limit(3)
          .then(({ data }) => (data ?? []) as { id: string; url: string }[])
      : Promise.resolve([] as { id: string; url: string }[]),
  ]);

  const viewerRole: string | null = viewerRoleResult;

  // ── Resolve campaign hero images ──────────────────────────────────────────
  const rawCampaigns = profileCampaigns as Array<{
    id: string;
    title: string;
    slug: string;
    landing_page_slug: string | null;
    campaign_start_date: string | null;
    campaign_end_date: string | null;
    location_address: string | null;
    landing_page_config: Record<string, unknown> | null;
  }>;

  const heroWorkIds = rawCampaigns
    .map((c) => (c.landing_page_config as { hero_work_id?: string } | null)?.hero_work_id)
    .filter((id): id is string => !!id);

  const heroImages =
    heroWorkIds.length > 0
      ? await supabase
          .from("artworks")
          .select("id, url")
          .in("id", heroWorkIds)
          .then(({ data }) => data ?? [])
      : [];

  const heroImageMap = Object.fromEntries(heroImages.map((img: { id: string; url: string | null }) => [img.id, img.url]));

  const resolvedCampaigns: import("@/components/profile/CampaignsSection").CampaignForProfile[] = rawCampaigns.map((c) => {
    const heroWorkId = (c.landing_page_config as { hero_work_id?: string } | null)?.hero_work_id ?? null;
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      landing_page_slug: c.landing_page_slug,
      campaign_start_date: c.campaign_start_date,
      campaign_end_date: c.campaign_end_date,
      location_address: c.location_address,
      hero_image_url: heroWorkId ? (heroImageMap[heroWorkId] ?? null) : null,
    };
  });

  // ── Phase 2: Tab-conditional fetches ─────────────────────────────────────
  const needsPortfolio        = isArtistProfile && (tab === "overview" || tab === "work");
  const needsUpdates          = isArtistProfile && (tab === "overview" || tab === "work");
  const needsProjects         = isArtistProfile && tab === "work" && !isOwner;
  const needsSold             = isArtistProfile && tab === "work";
  const needsCreative         = isArtistProfile && tab === "work";
  const needsAchievements     = isArtistProfile && (tab === "overview" || tab === "cv");
  const needsTiers            = isArtistProfile && tab === "support" && profile.support_enabled;
  const needsCollaborations   = isArtistProfile && tab === "work";
  const needsArtistCollection = isArtistProfile && tab === "work";
  const needsSeries           = isArtistProfile && (tab === "work" || tab === "overview");
  const needsSeriesArtworkIds = isArtistProfile && needsPortfolio;

  const [portfolioImages, studioUpdates, tabProjects, soldWorks, creativeWorks, achievements, supportTiers, collaboratedWorks, featuredBlogPost, artworkEditionsData, artistCollectionWorks, seriesRaw, seriesArtworkIdsRaw, featuredSoldWorks] = await Promise.all([
    needsPortfolio
      ? supabase
          .from("artworks")
          .select("*")
          .eq("profile_id", profile.id)
          .eq("creator_id", profile.id)
          .eq("current_owner_id", profile.id)
          .eq("hide_from_archive", false)
          .order("position", { ascending: true })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    needsUpdates ? getArtistUpdates(profile.id) : Promise.resolve([]),
    needsProjects ? getArtistProjects(profile.id) : Promise.resolve([]),
    needsSold
      ? supabase
          .from("artworks")
          .select("*, owner_profile:current_owner_id(username, full_name), editions(id, type)")
          .eq("creator_id", profile.id)
          .neq("current_owner_id", profile.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => (data ?? []).filter((w) => {
            // Only show originals in the artist's sold section.
            // Print editions (limited/open/product) appear in patron collections instead.
            const eds = (w.editions as { id: string; type: string }[] | null) ?? [];
            return eds.length === 0 || eds.every(e => e.type === "original");
          }))
      : Promise.resolve([]),
    needsCreative
      ? supabase
          .from("creative_works")
          .select("*")
          .eq("profile_id", profile.id)
          .order("position", { ascending: true })
          .then(({ data }) => (data ?? []) as CreativeWork[])
      : Promise.resolve([] as CreativeWork[]),
    needsAchievements
      ? supabase
          .from("profile_achievements")
          .select("*")
          .eq("profile_id", profile.id)
          .order("year", { ascending: false })
          .then(({ data }) => (data ?? []) as ProfileAchievement[])
      : Promise.resolve([] as ProfileAchievement[]),
    needsTiers
      ? supabase
          .from("support_tiers")
          .select("*")
          .eq("profile_id", profile.id)
          .order("sort_order", { ascending: true })
          .then(({ data }) => (data ?? []) as SupportTier[])
      : Promise.resolve([] as SupportTier[]),
    needsCollaborations
      ? supabase
          .from("artworks")
          .select("id, url, caption, creator_profile:profile_id(username, full_name)")
          .contains("collaborator_ids", [profile.id])
          .eq("is_available", false)
          .order("created_at", { ascending: false })
          .limit(24)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ data }) => (data ?? []) as unknown as Array<{ id: string; url: string | null; caption: string | null; creator_profile: { username: string; full_name: string | null } | null }>)
      : Promise.resolve([] as Array<{ id: string; url: string | null; caption: string | null; creator_profile: { username: string; full_name: string | null } | null }>),
    // Latest blog post featuring this artist (shown in identity block on all tabs)
    isArtistProfile
      ? supabase
          .from("blog_posts")
          .select("slug, title, image_url, published_at")
          .eq("featured_profile_id", profile.id)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => data as { slug: string; title: string; image_url: string | null; published_at: string | null } | null)
      : Promise.resolve(null),
    // Editions for available works — direct join on work_id
    isArtistProfile && (availableWorks as Artwork[]).length > 0
      ? supabase
          .from("editions")
          .select("id, work_id, label, type, price_cents, currency, poa, listing_mode, listed, sort_order, dimensions")
          .in("work_id", (availableWorks as Artwork[]).map((w) => w.id))
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    // Works in this artist's collection (queried via collection_membership.is_public)
    needsArtistCollection
      ? supabase
          .from("collection_membership")
          .select("position, artwork:artwork_id(*, creator_profile:creator_id(username, full_name, avatar_url))")
          .eq("holder_id", profile.id)
          .eq("is_public", true)
          .order("position", { ascending: true })
          .then(({ data }) => (data ?? []).map((m) => m.artwork).filter(Boolean))
      : Promise.resolve([]),
    // Series — for the Work tab series row
    needsSeries
      ? supabase
          .from("series")
          .select("id, title, slug, hero_image_url, is_featured, position, year, series_artworks(count)")
          .eq("artist_id", profile.id)
          .order("position", { ascending: true })
          .then(({ data }) => (data ?? []).map(s => ({
            id: s.id,
            title: s.title,
            slug: s.slug,
            hero_image_url: s.hero_image_url as string | null,
            is_featured: s.is_featured as boolean,
            position: s.position as number,
            year: (s.year as number | null) ?? undefined,
            artworkCount: Array.isArray(s.series_artworks)
              ? (s.series_artworks[0] as { count: number } | undefined)?.count ?? 0
              : 0,
          })))
      : Promise.resolve([] as Array<{ id: string; title: string; slug: string; hero_image_url: string | null; is_featured: boolean; position: number; year?: number; artworkCount: number }>),
    // Series artwork IDs — to exclude from the portfolio gallery
    needsSeriesArtworkIds
      ? supabase
          .from("series")
          .select("series_artworks(artwork_id)")
          .eq("artist_id", profile.id)
          .then(({ data }) =>
            (data ?? []).flatMap(s =>
              (s.series_artworks as { artwork_id: string }[]).map(sa => sa.artwork_id)
            )
          )
      : Promise.resolve([] as string[]),
    // Featured works the artist has sold — surfaced in the Overview "Selected Work" strip
    needsPortfolio
      ? supabase
          .from("artworks")
          .select("*, editions(id, type)")
          .eq("creator_id", profile.id)
          .neq("current_owner_id", profile.id)
          .eq("is_featured", true)
          .eq("hide_from_archive", false)
          .order("position", { ascending: true })
          .then(({ data }) => (data ?? []).filter((w) => {
            const eds = (w.editions as { id: string; type: string }[] | null) ?? [];
            return eds.length === 0 || eds.every(e => e.type === "original");
          }))
      : Promise.resolve([]),
  ]);

  // Build map: artworks.id → listed editions sorted by sort_order
  const artworkEditionsMap: Record<string, EditionOption[]> = {};
  for (const ed of artworkEditionsData as Array<{ work_id: string; id: string; listed: boolean | null; sort_order: number | null } & EditionOption>) {
    if (ed.listed === false) continue;
    if (!artworkEditionsMap[ed.work_id]) artworkEditionsMap[ed.work_id] = [];
    artworkEditionsMap[ed.work_id].push(ed as EditionOption);
  }
  for (const key of Object.keys(artworkEditionsMap)) {
    artworkEditionsMap[key].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  // Attach editions to each available work
  const enrichedAvailableWorks = (availableWorks as Artwork[]).map((w) => ({
    ...w,
    editions: artworkEditionsMap[w.id] ?? [],
  }));

  // Merge: owner gets projects from phase 1 (for modal), others from phase 2
  const artistProjects = ownerProjects.length > 0 ? ownerProjects : tabProjects;

  const seriesArtworkIdSet = new Set(seriesArtworkIdsRaw as string[]);
  const images = (portfolioImages as Artwork[]).filter(img => !seriesArtworkIdSet.has(img.id));

  const followingArtists = followsData as Pick<Profile, "id" | "username" | "full_name" | "avatar_url">[];

  // Use full data when loaded; fall back to cheap counts for tabs that skip full fetches
  const portfolioCount = (portfolioCountResult as { count: number | null }).count ?? 0;
  const hasSoldWork = ((hasSoldWorkResult as { count: number | null }).count ?? 0) > 0;
  const isCollected = isArtistProfile && (hasSoldWork || soldWorks.length > 0);
  // Incomplete profiles don't expose available works to the public.
  const publicAvailableWorks = (isOwner || isProfileComplete(profile) ? enrichedAvailableWorks : []) as Artwork[];

  const imagesCount = images.length > 0 ? images.length : portfolioCount;
  const worksCount = isArtistProfile ? publicAvailableWorks.length + imagesCount : 0;
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
      {/* LCP element. Served via the Supabase render endpoint at a fixed 1600px
          (a CDN-cached WebP) rather than next/image — which would generate a
          1920–3840px variant on demand on wide/retina screens, the slow path.
          Plain <img> with high fetch priority so it's in the initial HTML and
          paints without waiting on client JS. */}
      <div className="w-full aspect-[42/9] relative overflow-hidden">
        {profile.featured_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={supabaseTransform(profile.featured_image_url, { width: 1600, quality: 80 }) ?? profile.featured_image_url}
            alt={`${displayName} banner`}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `center ${profile.banner_focus_y ?? 50}%` }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getBannerGradient(profile.username) }}
          />
        )}
      </div>

      <div className="px-4 sm:px-6 space-y-8 sm:space-y-10">

        {/* ── Identity block ── */}
        <div className="-mt-[60px] sm:-mt-[100px]">
          {profile.avatar_url ? (
            <div className="relative w-[120px] h-[120px] sm:w-[200px] sm:h-[200px] shrink-0 border-2 border-background overflow-hidden bg-background outline outline-1 outline-black z-10 mb-4">
              <Image
                src={profile.avatar_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="200px"
              />
            </div>
          ) : (
            <div
              className="relative w-[120px] h-[120px] sm:w-[200px] sm:h-[200px] shrink-0 border-2 border-background outline outline-1 outline-black z-10 mb-4 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${getAvatarGradient(profile.username).from} 0%, ${getAvatarGradient(profile.username).to} 100%)` }}
            >
              <span className="text-4xl sm:text-6xl font-semibold text-white/90 select-none">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-stretch lg:justify-between gap-8">

            {/* Left: name, meta line, bio, action row */}
            <div className="space-y-3 max-w-3xl lg:flex-1">
              <div className="space-y-1">
                <h1 className="text-4xl font-bold tracking-tight">{displayName}</h1>
                {profile.is_patronage_supported && (
                  <p className="text-[10px] text-muted-foreground tracking-wide opacity-70">With Patronage</p>
                )}
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>

              {/* Single meta line: disciplines · career stage · location */}
              {isArtistProfile && (() => {
                const parts: string[] = [];
                const disciplineLabels = profile.disciplines?.length
                  ? profile.disciplines.map((d) => DISCIPLINE_LABELS[d] ?? d)
                  : (profile.medium ?? []);
                if (disciplineLabels.length) parts.push(disciplineLabels.join(", "));
                if (profile.career_stage) parts.push(profile.career_stage);
                const loc = [
                  (profile as Profile & { city?: string | null }).city,
                  profile.country,
                ].filter(Boolean).join(", ");
                if (loc) parts.push(loc);
                return parts.length > 0
                  ? <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>
                  : null;
              })()}

              {/* Credential badges (quiet row below meta line) */}
              {profileBadges && (profileBadges.verified || profileBadges.exhibited || profileBadges.grantRecipient || profileBadges.collected) && (
                <div className="flex flex-wrap gap-1.5">
                  {profileBadges.verified && (
                    <span className="text-xs border border-black/30 text-muted-foreground px-1.5 py-0.5 leading-none">Verified</span>
                  )}
                  {profileBadges.exhibited && (
                    <span className="text-xs border border-black/30 text-muted-foreground px-1.5 py-0.5 leading-none">Exhibited</span>
                  )}
                  {profileBadges.grantRecipient && (
                    <span className="text-xs border border-black/30 text-muted-foreground px-1.5 py-0.5 leading-none">Grant Recipient</span>
                  )}
                  {profileBadges.collected && (
                    <span className="text-xs border border-black/30 text-muted-foreground px-1.5 py-0.5 leading-none">Collected</span>
                  )}
                </div>
              )}

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

              {isArtistProfile && publicAvailableWorks.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <Link
                    href={`/${profile.username}?tab=work`}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    {publicAvailableWorks.length} work{publicAvailableWorks.length !== 1 ? "s" : ""} available
                  </Link>
                </p>
              )}

              {/* Action row: owner edit / follow + message + icon links */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {isOwner && (
                  <Link
                    href="/studio"
                    className="text-xs border border-border px-3 py-1.5 hover:bg-muted transition-colors"
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
                  <>
                    <FollowButton followingId={profile.id} initialIsFollowing={alreadyFollowing} />
                    <MessageButton otherUserId={profile.id} />
                  </>
                )}
                {profile.website_url && (
                  <TrackedLink
                    href={profile.website_url}
                    profileId={profile.id}
                    username={profile.username}
                    eventType="website_click"
                    className="p-2 border border-border hover:bg-muted transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                  </TrackedLink>
                )}
                {profile.instagram_handle && (
                  <a
                    href={`https://instagram.com/${profile.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-border hover:bg-muted transition-colors"
                    title={`@${profile.instagram_handle}`}
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {profile.cv_url && (
                  <TrackedLink
                    href={profile.cv_url}
                    profileId={profile.id}
                    username={profile.username}
                    eventType="cv_click"
                    className="p-2 border border-border hover:bg-muted transition-colors text-xs font-medium"
                  >
                    CV
                  </TrackedLink>
                )}
                {/* Donation CTA — only renders for admin-approved charity
                    partners. Off-site link, opens in a new tab. */}
                {profile.role === "partner"
                  && profile.organisation_type === "charity"
                  && profile.donation_enabled
                  && profile.donation_url && (
                  <a
                    href={profile.donation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-foreground text-background hover:opacity-90 transition-opacity text-xs font-medium"
                  >
                    Support
                  </a>
                )}
                {/* Mobile-only share button — hidden on desktop where it lives top-right */}
                {isArtistProfile && (
                  <div className="lg:hidden">
                    <ShareTrigger
                      variant="icon"
                      className="p-2 border border-border hover:bg-muted transition-colors"
                      payload={{
                        type: "profile",
                        title: profile.full_name ?? profile.username,
                        sub: [profile.disciplines?.[0]?.replace(/_/g, " "), profile.city ?? profile.country].filter(Boolean).join(" · "),
                        price: null,
                        tag: "ARTIST",
                        handle: `@${profile.username}`,
                        imageUrl: profile.avatar_url,
                        shareUrl: `https://patronage.nz/${profile.username}`,
                        imageOptions: (() => {
                          const opts = [
                            ...(profile.avatar_url ? [{ url: profile.avatar_url, label: "Avatar" }] : []),
                            ...sharePortfolioImages.slice(0, 3).map((w, i) => ({ url: w.url!, label: `Work ${i + 1}` })),
                          ];
                          return opts.length > 1 ? opts : undefined;
                        })(),
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right: share button (desktop) + optional featured blog post card */}
            {isArtistProfile && (() => {
              const shareImageOptions = [
                ...(profile.avatar_url ? [{ url: profile.avatar_url, label: "Avatar" }] : []),
                ...sharePortfolioImages.slice(0, 3)
                  .map((w, i) => ({ url: w.url!, label: `Work ${i + 1}` })),
              ];
              const sharePayload = {
                type: "profile" as const,
                title: profile.full_name ?? profile.username,
                sub: [profile.disciplines?.[0]?.replace(/_/g, " "), profile.city ?? profile.country].filter(Boolean).join(" · "),
                price: null,
                tag: "ARTIST",
                handle: `@${profile.username}`,
                imageUrl: profile.avatar_url,
                shareUrl: `https://patronage.nz/${profile.username}`,
                imageOptions: shareImageOptions.length > 1 ? shareImageOptions : undefined,
              };
              return (
                <div className="flex flex-col justify-between items-end shrink-0 gap-3">
                  {/* Desktop-only share button — mobile version lives in the action row */}
                  <div className="hidden lg:block">
                    <ShareTrigger
                      variant="icon"
                      className="p-2 border border-border hover:bg-muted transition-colors"
                      payload={sharePayload}
                    />
                  </div>
                  {featuredBlogPost && (isOwner || !profile.hide_blog_card) && (
                    <div className="space-y-1">
                      {!profile.hide_blog_card && (
                        <Link
                          href={`/blog/${featuredBlogPost.slug}`}
                          className="group flex items-center gap-4 border border-black px-5 py-4 hover:shadow-sm transition-shadow lg:w-80"
                        >
                          {featuredBlogPost.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={featuredBlogPost.image_url}
                              alt=""
                              className="shrink-0 block w-auto"
                              style={{ height: "48px" }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
                              Featured on Patronage
                            </p>
                            <p className="text-sm font-semibold leading-snug group-hover:underline underline-offset-2 line-clamp-2">
                              {featuredBlogPost.title}
                            </p>
                          </div>
                          <span className="text-stone-400 shrink-0 text-sm group-hover:text-foreground transition-colors">→</span>
                        </Link>
                      )}
                      {isOwner && (
                        <HideBlogCardToggle hidden={profile.hide_blog_card} />
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Artist profile: tabbed layout ── */}
        {isArtistProfile && (
          <>
            <ProfileTabs username={profile.username} tab={tab} artistName={profile.full_name ?? profile.username} />

            <div>
              {tab === "overview" && (
                <OverviewTab
                  exhibitions={exhibitions}
                  bibliography={bibliography}
                  receivedGrants={profile.received_grants ?? []}
                  achievements={achievements}
                  portfolioImages={images}
                  featuredSoldWorks={featuredSoldWorks as PortfolioImage[]}
                  seriesList={seriesRaw as Array<{ id: string; title: string; slug: string; hero_image_url: string | null; is_featured: boolean; position: number; year?: number; artworkCount: number }>}
                  studioUpdates={studioUpdates}
                  artistName={displayName}
                  viewerRole={viewerRole}
                  username={profile.username}
                  profileId={isOwner ? undefined : profile.id}
                  isOwner={isOwner}
                  galleryRowHeight={profile.gallery_row_height}
                  galleryGutter={profile.gallery_gutter}
                  campaigns={resolvedCampaigns}
                />
              )}

              {tab === "work" && (
                <WorkTab
                  portfolioImages={images}
                  availableWorks={publicAvailableWorks}
                  soldWorks={soldWorks as (Artwork & { owner_profile: { username: string; full_name: string | null } | null })[]}
                  collectionWorks={artistCollectionWorks as unknown as (Artwork & { creator_profile: { username: string; full_name: string | null; avatar_url: string | null } | null })[]}
                  seriesList={seriesRaw as Array<{ id: string; title: string; slug: string; hero_image_url: string | null; is_featured: boolean; position: number; year?: number; artworkCount: number }>}
                  profileId={profile.id}
                  username={profile.username}
                  artistName={displayName}
                  artistAvatarUrl={profile.avatar_url}
                  viewerRole={viewerRole}
                  isOwner={isOwner}
                  hideSoldSection={profile.hide_sold_section}
                  displayName={displayName}
                  galleryRowHeight={profile.gallery_row_height}
                  galleryGutter={profile.gallery_gutter}
                  worksRowH={profile.works_row_height}
                  worksHGap={profile.works_h_gap}
                  worksVGap={profile.works_v_gap}
                  worksLastRowAlign={profile.works_last_row_align}
                />
              )}

              {tab === "cv" && (
                <CvTab
                  exhibitions={exhibitions}
                  bibliography={bibliography}
                  receivedGrants={profile.received_grants ?? []}
                  achievements={achievements}
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
                  tiers={supportTiers}
                  userEmail={user?.email ?? undefined}
                  stripeConnected={profile.stripe_connect_status === "enabled"}
                />
              )}
            </div>
          </>
        )}

        {/* ── Patron / Partner sections ── */}
        {!isArtistProfile && (() => {
          // Public collection works for grid + tab visibility check
          const publicCollectionWorks = (collectionWorks as (Artwork & { creator_profile: { username: string; full_name: string | null; avatar_url: string | null } | null })[])
            .filter((w) => w.collection_visible);
          const showCollectionTab = (profile.collection_public ?? true) && publicCollectionWorks.length > 0;

          const collectionGridWorks: ArtworkForGrid[] = publicCollectionWorks.map((w) => ({
            id: w.id,
            url: w.url,
            title: w.title,
            caption: w.caption,
            price_cents: w.price_cents,
            is_poa: w.is_poa,
            price_currency: w.price_currency as "NZD" | "AUD",
            medium: w.medium,
            hide_price: w.hide_price,
            profile: w.creator_profile
              ? { username: w.creator_profile.username, full_name: w.creator_profile.full_name, avatar_url: w.creator_profile.avatar_url }
              : null,
          }));

          return (
            <>
              {/* Patron tab bar — only shows Collection tab when public works exist */}
              {(isOwner || showCollectionTab) && (
                <nav className="flex gap-6 border-b border-border">
                  <Link
                    href={`/${profile.username}`}
                    className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${patronTab === "overview" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    Overview
                  </Link>
                  {showCollectionTab && (
                    <Link
                      href={`/${profile.username}?ptab=collection`}
                      className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${patronTab === "collection" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      Collection
                    </Link>
                  )}
                </nav>
              )}

              {patronTab === "collection" && showCollectionTab ? (
                <div className="py-6">
                  <WorksJustifiedGrid artworks={collectionGridWorks} />
                </div>
              ) : (
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
            </>
          );
        })()}

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
