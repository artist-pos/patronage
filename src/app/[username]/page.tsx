import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
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
import {
  PartnerProfileView,
  PatronProfileView,
  type ArtistTileData,
  type PastOpportunityRow,
  type CollectedWorkTile,
} from "@/components/profile/OrgPatronProfiles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignForProfile } from "@/components/profile/CampaignsSection";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import dynamic from "next/dynamic";
import { ProfileUpdatesSection } from "@/components/profile/ProfileUpdatesSection";
import { ProfileStickyBar } from "@/components/profile/ProfileStickyBar";

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
import type { EditionOption } from "@/components/feed/WorksJustifiedGrid";
import { computeBadges } from "@/lib/badges";
import { getBannerGradient } from "@/lib/defaults";
import { HideBlogCardToggle } from "@/components/profile/HideBlogCardToggle";

const DISCIPLINE_LABELS: Record<string, string> = {
  visual_art: "Visual Art", music: "Music", poetry: "Poetry",
  writing: "Writing", dance: "Dance", film: "Film",
  photography: "Photography", craft: "Craft", performance: "Performance", other: "Other",
};

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; ptab?: string; artwork?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Artist not found — Patronage" };

  const displayName = profile.full_name ?? profile.username;

  // Private supporters (migration 170): never leak the name into metadata
  const metaIsArtist = profile.role === "artist" || profile.role === "owner";
  if (!metaIsArtist && profile.role !== "partner" && profile.private_supporter) {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
    return {
      title: "Private supporter | Patronage",
      description: "This patron supports artists on Patronage privately.",
      alternates: { canonical: `${base}/${username}` },
      robots: { index: false },
    };
  }

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
  // v2: all profiles are a single scrolling page — legacy ?tab=/?ptab= links
  // land on the page and can deep-link via #work / #cv / #support anchors.
  const { artwork: artworkParam } = await searchParams;

  // Legacy ?artwork= deep links used to scroll-and-open a modal in the
  // available-works grid; the artwork detail page is now the canonical target.
  if (artworkParam) redirect(`/${username}/works/${artworkParam}`);

  // Profile and auth resolve in one wave; getServerUser is request-deduped
  // with the Header so this adds no extra auth round-trip.
  const [profile, { supabase, user }] = await Promise.all([
    getProfile(username),
    getServerUser(),
  ]);
  if (!profile) notFound();

  const canMessage = !!user && user.id !== profile.id;
  const isOwner = !!user && user.id === profile.id;

  const isArtistProfile = profile.role === "artist" || profile.role === "owner";

  // ── Section-fetch flags — v2 profile is a single scrolling page (no tabs),
  // so every artist section loads on the one request.
  const needsPortfolio        = isArtistProfile;
  const needsUpdates          = isArtistProfile;
  const needsProjects         = isArtistProfile && !isOwner;
  const needsSold             = isArtistProfile;
  const needsCreative         = isArtistProfile;
  const needsAchievements     = isArtistProfile;
  const needsTiers            = isArtistProfile && profile.support_enabled;
  const needsCollaborations   = isArtistProfile;
  const needsArtistCollection = isArtistProfile;
  const needsSeries           = isArtistProfile;
  const needsSeriesArtworkIds = isArtistProfile && needsPortfolio;

  // Available works — extracted as a named promise so the editions lookup can
  // chain on its result instead of gating a second sequential wave.
  const availableWorksPromise: PromiseLike<Artwork[]> = isArtistProfile
    ? (() => {
        const q = supabase
          .from("artworks")
          .select("*")
          .eq("profile_id", profile.id)
          .eq("is_available", true);
        return (!isOwner ? q.eq("hide_available", false) : q)
          .order("position", { ascending: true })
          .then(({ data }) => (data ?? []) as Artwork[]);
      })()
    : Promise.resolve([]);

  // ── Phase 2 (started FIRST, unawaited): section fetches. These depend only
  // on the profile row, so they run concurrently with Phase 1 below instead of
  // as a second sequential wave.
  const phase2Promise = Promise.all([
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
    // Editions for available works — chained on the availableWorks promise so
    // it fires the moment the IDs exist rather than a full wave later.
    availableWorksPromise.then((works) =>
      isArtistProfile && works.length > 0
        ? supabase
            .from("editions")
            .select("id, work_id, label, type, price_cents, currency, poa, listing_mode, listed, sort_order, dimensions")
            .in("work_id", works.map((w) => w.id))
            .then(({ data }) => data ?? [])
        : Promise.resolve([])
    ),
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
    availableWorksPromise,
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
              .select("id, username, full_name, avatar_url, medium")
              .in("id", ids);
            return (artists ?? []) as Pick<Profile, "id" | "username" | "full_name" | "avatar_url" | "medium">[];
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

  // ── Partner trust signals (partner profiles only) ──────────────────────────
  // Application rows aren't publicly readable under RLS, but aggregate counts
  // and the identities of publicly selected artists are the partner page's
  // trust content — resolved server-side via the admin client, never sent raw.
  let partnerListedCount = 0;
  let partnerPastOpps: PastOpportunityRow[] = [];
  let partnerArtists: ArtistTileData[] = [];
  let partnerSelectedTotal = 0;
  if (!isArtistProfile && profile.role === "partner") {
    const adminDb = createAdminClient();
    const todayStr = new Date().toISOString().split("T")[0];
    const [listedRes, pastRes, appsRes] = await Promise.all([
      supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("status", "published"),
      supabase
        .from("opportunities")
        .select("id, slug, title, type, deadline")
        .eq("profile_id", profile.id)
        .eq("status", "published")
        .lt("deadline", todayStr)
        .order("deadline", { ascending: false })
        .limit(8),
      adminDb
        .from("opportunity_applications")
        .select("artist_id, opportunity_id, opportunities!inner(profile_id)")
        .eq("opportunities.profile_id", profile.id)
        .in("status", ["selected", "approved_pending_assets", "production_ready"]),
    ]);
    partnerListedCount = listedRes.count ?? 0;
    const apps = (appsRes.data ?? []) as unknown as Array<{ artist_id: string; opportunity_id: string }>;
    const selectedByOpp = new Map<string, number>();
    for (const a of apps) {
      selectedByOpp.set(a.opportunity_id, (selectedByOpp.get(a.opportunity_id) ?? 0) + 1);
    }
    partnerPastOpps = ((pastRes.data ?? []) as Array<{ id: string; slug: string | null; title: string; type: string; deadline: string | null }>)
      .map((o) => ({ ...o, selectedCount: selectedByOpp.get(o.id) ?? 0 }));
    const artistIds = [...new Set(apps.map((a) => a.artist_id))];
    partnerSelectedTotal = artistIds.length;
    if (artistIds.length > 0) {
      const { data: selectedArtists } = await adminDb
        .from("profiles")
        .select("id, username, full_name, avatar_url, medium")
        .in("id", artistIds.slice(0, 12));
      partnerArtists = (selectedArtists ?? []) as ArtistTileData[];
    }
  }

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

  // ── Phase 2 results — started before Phase 1 above; by now the queries have
  // been running concurrently with Phase 1, so this await is (near) free.
  const [portfolioImages, studioUpdates, tabProjects, soldWorks, creativeWorks, achievements, supportTiers, collaboratedWorks, featuredBlogPost, artworkEditionsData, artistCollectionWorks, seriesRaw, seriesArtworkIdsRaw, featuredSoldWorks] = await phase2Promise;

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

  // Incomplete profiles don't expose available works to the public.
  const publicAvailableWorks = (isOwner || isProfileComplete(profile) ? enrichedAvailableWorks : []) as Artwork[];

  // The archive is the complete record — every work, availability shown as a
  // chip. Only works represented by a series card are folded away.
  const seriesArtworkIdSet = new Set(seriesArtworkIdsRaw as string[]);
  const images = (portfolioImages as Artwork[]).filter(
    (img) => !seriesArtworkIdSet.has(img.id)
  );

  const followingArtists = followsData as ArtistTileData[];

  // Patron collection tiles — public works only, prices never shown
  const publicCollectionWorks = !isArtistProfile
    ? (collectionWorks as (Artwork & { creator_profile: { username: string; full_name: string | null; avatar_url: string | null } | null })[])
        .filter((w) => w.collection_visible)
    : [];
  const showPatronCollection = (profile.collection_public ?? true) && publicCollectionWorks.length > 0;
  const patronCollectedWorks: CollectedWorkTile[] = publicCollectionWorks.map((w) => ({
    id: w.id,
    url: w.url,
    title: w.title,
    artistName: w.creator_profile?.full_name ?? w.creator_profile?.username ?? null,
    href: w.creator_profile
      ? `/${w.creator_profile.username}/works/${(w as Artwork & { slug?: string | null }).slug ?? w.id}`
      : null,
  }));

  // Use full data when loaded; fall back to cheap counts for tabs that skip full fetches
  const portfolioCount = (portfolioCountResult as { count: number | null }).count ?? 0;
  const hasSoldWork = ((hasSoldWorkResult as { count: number | null }).count ?? 0) > 0;
  const isCollected = isArtistProfile && (hasSoldWork || soldWorks.length > 0);

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

  // Private supporter (migration 170): mask identity for everyone but the
  // owner — cover, name, bio, links, collection. Following stays public.
  const maskPatron =
    !isArtistProfile &&
    profile.role !== "partner" &&
    !!profile.private_supporter &&
    !isOwner;
  const publicDisplayName = maskPatron ? "Private supporter" : displayName;

  // Support surfaces only exist for visitors when there's something to buy —
  // enabled with zero active tiers stays owner-only.
  const hasActiveTiers = (supportTiers as SupportTier[]).some((t) => t.is_active);
  const showSupport = profile.support_enabled && hasActiveTiers && !isOwner;

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
        name: publicDisplayName,
        url: profileUrl,
        ...(!maskPatron && profile.avatar_url && { image: profile.avatar_url }),
        ...(!maskPatron && profile.bio && { description: profile.bio }),
        ...(!maskPatron && jsonLdDisciplines.length > 0 && {
          jobTitle: jsonLdDisciplines.join(", "),
          knowsAbout: jsonLdDisciplines,
        }),
        ...(!maskPatron && profile.country && {
          address: {
            "@type": "PostalAddress",
            addressCountry: profile.country,
          },
        }),
        ...(!maskPatron && sameAs.length > 0 && { sameAs }),
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

      {/* ══ v2 Artist header — full-bleed cover with overlaid name,
             action bar, bio + selected press. No tabs, no avatar block. ══ */}
      {isArtistProfile && (() => {
        const shareImageOptions = [
          ...(profile.avatar_url ? [{ url: profile.avatar_url, label: "Avatar" }] : []),
          ...sharePortfolioImages.slice(0, 3).map((w, i) => ({ url: w.url!, label: `Work ${i + 1}` })),
        ];
        const sharePayload = {
          type: "profile" as const,
          title: displayName,
          sub: [profile.disciplines?.[0]?.replace(/_/g, " "), profile.city ?? profile.country].filter(Boolean).join(" · "),
          price: null,
          tag: "ARTIST",
          handle: `@${profile.username}`,
          imageUrl: profile.avatar_url,
          shareUrl: `https://patronage.nz/${profile.username}`,
          imageOptions: shareImageOptions.length > 1 ? shareImageOptions : undefined,
        };
        const disciplineLabels = profile.disciplines?.length
          ? profile.disciplines.map((d) => DISCIPLINE_LABELS[d] ?? d)
          : (profile.medium ?? []);
        const loc = [
          (profile as Profile & { city?: string | null }).city,
          profile.country,
        ].filter(Boolean).join(", ");
        const pressItems = bibliography.slice(0, 2);
        const showBlogCard = !!featuredBlogPost && (isOwner || !profile.hide_blog_card);
        // Only split into two columns when the aside actually has content —
        // otherwise a short or line-broken bio sits beside a dead half-page.
        const hasAside = showBlogCard || pressItems.length > 0;
        const hasBadges = !!profileBadges && (profileBadges.verified || profileBadges.exhibited || profileBadges.grantRecipient || profileBadges.collected);
        return (
          <>
            {/* Cover — LCP element; plain <img> via the Supabase render endpoint */}
            <div className="relative h-[300px] w-full overflow-hidden sm:h-[380px]">
              {profile.featured_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.featured_image_url}
                  alt={`${displayName} cover`}
                  fetchPriority="high"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: `center ${profile.banner_focus_y ?? 50}%` }}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: getBannerGradient(profile.username) }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.65) 100%)" }}
              />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 sm:px-6">
                <Link
                  href="/artists"
                  className="mb-3 inline-block font-mono text-[10px] tracking-[0.12em] text-white/50 transition-colors hover:text-white/85"
                >
                  ← Artists
                </Link>
                <div className="flex items-end gap-4 sm:gap-5">
                  {profile.avatar_url && (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden sm:h-24 sm:w-24">
                      <Image
                        src={profile.avatar_url}
                        alt={displayName}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="mb-3 text-[40px] font-semibold leading-[0.94] tracking-[-0.045em] text-white sm:text-6xl">
                      {displayName}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-xs text-white/55">
                      {loc && <span>{loc}</span>}
                      {loc && disciplineLabels.length > 0 && (
                        <span aria-hidden className="text-white/25">·</span>
                      )}
                      {disciplineLabels.length > 0 && (
                        <span className="lowercase">{disciplineLabels.join(" · ")}</span>
                      )}
                      {profile.open_for_commissions && (
                        <>
                          <span aria-hidden className="text-white/25">·</span>
                          <span className="flex items-center gap-1.5 text-[color:var(--success)]">
                            <span className="h-[6px] w-[6px] rounded-full bg-success" />
                            open for commissions
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  {hasBadges ? (
                    <>
                      {profileBadges!.verified && <span className="badge badge-verified">Verified</span>}
                      {profileBadges!.exhibited && <span className="badge badge-exhibited">Exhibited</span>}
                      {profileBadges!.grantRecipient && <span className="badge badge-grant">Grant Recipient</span>}
                      {profileBadges!.collected && <span className="badge badge-exhibited">Collected</span>}
                    </>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">@{profile.username}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner && (
                    <Link
                      href="/studio"
                      className="flex h-9 items-center border border-border px-3 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                    >
                      Edit Profile
                    </Link>
                  )}
                  {isOwner && (
                    <LazyCreateUpdateModal
                      profileId={profile.id}
                      label="Post a studio update +"
                      projects={artistProjects.map((p) => ({ id: p.id, title: p.title }))}
                    />
                  )}
                  {!isOwner && (
                    <>
                      <FollowButton
                        followingId={profile.id}
                        initialIsFollowing={alreadyFollowing}
                        isAuthenticated={!!user}
                      />
                      <MessageButton otherUserId={profile.id} />
                    </>
                  )}
                  {showSupport && (
                    <a
                      href="#support"
                      className="inline-flex h-9 items-center bg-brand px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                    >
                      Support this artist
                    </a>
                  )}
                  {profile.website_url && (
                    <TrackedLink
                      href={profile.website_url}
                      profileId={profile.id}
                      username={profile.username}
                      eventType="website_click"
                      className="flex h-9 w-9 items-center justify-center border border-border transition-colors hover:bg-muted"
                    >
                      <Globe className="h-4 w-4" />
                    </TrackedLink>
                  )}
                  {profile.instagram_handle && (
                    <a
                      href={`https://instagram.com/${profile.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center border border-border transition-colors hover:bg-muted"
                      title={`@${profile.instagram_handle}`}
                    >
                      <Instagram className="h-4 w-4" />
                    </a>
                  )}
                  {profile.cv_url && (
                    <TrackedLink
                      href={profile.cv_url}
                      profileId={profile.id}
                      username={profile.username}
                      eventType="cv_click"
                      className="flex h-9 items-center border border-border px-2.5 font-mono text-[11px] transition-colors hover:bg-muted"
                    >
                      CV
                    </TrackedLink>
                  )}
                  <ShareTrigger
                    variant="icon"
                    className="flex h-9 w-9 items-center justify-center border border-border transition-colors hover:bg-muted"
                    payload={sharePayload}
                  />
                </div>
              </div>
            </div>

            {/* Sticky mini-header — keeps name + patron actions in reach once
                the cover and action bar have scrolled away */}
            <ProfileStickyBar name={displayName}>
              {!isOwner && (
                <FollowButton
                  followingId={profile.id}
                  initialIsFollowing={alreadyFollowing}
                  isAuthenticated={!!user}
                />
              )}
              {showSupport && (
                <a
                  href="#support"
                  className="inline-flex h-9 items-center bg-brand px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                >
                  Support
                </a>
              )}
            </ProfileStickyBar>

            {/* Bio + selected press — 2 col desktop */}
            {(profile.bio || hasAside) && (
              <div className="border-b border-border px-4 py-9 sm:px-6">
                <div className={`grid items-start gap-10 ${hasAside ? "lg:grid-cols-[3fr_2fr] lg:gap-16" : ""}`}>
                  <div>
                    {profile.is_patronage_supported && (
                      <p className="mb-2 font-mono text-[10px] tracking-wide text-muted-foreground opacity-70">
                        With Patronage
                      </p>
                    )}
                    {profile.bio && (
                      <p className="max-w-[62ch] whitespace-pre-wrap text-[17px] leading-[1.72] text-[color:var(--fg-muted)]">
                        {profile.bio}
                      </p>
                    )}
                    {publicAvailableWorks.length > 0 && (
                      <p className="mt-4">
                        <a
                          href="#work"
                          className="font-mono text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                        >
                          {publicAvailableWorks.length} work{publicAvailableWorks.length !== 1 ? "s" : ""} available →
                        </a>
                      </p>
                    )}
                  </div>
                  {hasAside && (
                  <div className="space-y-7">
                    {showBlogCard && (
                      <div className="space-y-1">
                        {!profile.hide_blog_card && (
                          <Link
                            href={`/blog/${featuredBlogPost.slug}`}
                            className="group flex items-center gap-4 border border-border bg-card px-5 py-4 transition-colors hover:border-foreground"
                          >
                            {featuredBlogPost.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={featuredBlogPost.image_url}
                                alt=""
                                className="block w-auto shrink-0"
                                style={{ height: "48px" }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="t-section-label mb-1.5">Featured on Patronage</p>
                              <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline underline-offset-2">
                                {featuredBlogPost.title}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm text-[color:var(--fg-subtle)] transition-colors group-hover:text-foreground">→</span>
                          </Link>
                        )}
                        {isOwner && <HideBlogCardToggle hidden={profile.hide_blog_card} />}
                      </div>
                    )}
                    {pressItems.length > 0 && (
                      <div>
                        <h2 className="t-section-label mb-5">Selected press</h2>
                        <div className="flex flex-col gap-5">
                          {pressItems.map((item, i) => (
                            <div key={i}>
                              <div className="mb-1.5 text-base italic leading-[1.35] tracking-[-0.014em]">
                                {item.link ? (
                                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
                                    &ldquo;{item.title}&rdquo;
                                  </a>
                                ) : (
                                  <>&ldquo;{item.title}&rdquo;</>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                                {[item.publication, item.date].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ── v2 partner / patron profiles — full-width sections, own padding
             (brief: design_handoff_partner_patron_profiles) ── */}
      {!isArtistProfile && (profile.role === "partner" ? (
        <PartnerProfileView
          profile={profile}
          displayName={displayName}
          isOwner={isOwner}
          canMessage={canMessage}
          verified={!!(profile.bio && profile.avatar_url)}
          activeOpps={profileOpportunities}
          pastOpps={partnerPastOpps}
          commissionedArtists={partnerArtists}
          listedCount={partnerListedCount}
          selectedTotal={partnerSelectedTotal}
        />
      ) : (
        <PatronProfileView
          profile={profile}
          displayName={displayName}
          isOwner={isOwner}
          canMessage={canMessage}
          isAuthenticated={!!user}
          alreadyFollowing={alreadyFollowing}
          followingArtists={followingArtists}
          collectedWorks={patronCollectedWorks}
          showCollection={showPatronCollection}
          privateSupporter={maskPatron}
        />
      ))}

      <div className="px-4 sm:px-6 space-y-8 sm:space-y-10">

        {/* ── Artist profile: single scrolling page (v2 — no tabs) ──
            Order per the design: selected work + highlights → work & archive
            → CV → support. Anchors keep legacy ?tab= deep links usable. */}
        {isArtistProfile && (
          <div>
            <section id="work" aria-label="Work and archive">
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
            </section>

            <section id="cv" aria-label="CV" className="border-t border-border">
              <div className={profile.open_for_commissions ? "grid items-start gap-x-16 lg:grid-cols-[2fr_1fr]" : ""}>
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
                {profile.open_for_commissions && (
                  <aside className="mb-8 space-y-3 bg-[color:var(--tint)] p-5 lg:mt-14">
                    <p className="flex items-center gap-2 font-mono text-[11px] text-[color:var(--success)]">
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-success" />
                      Currently accepting commissions
                    </p>
                    {profile.commission_info && (
                      <p className="text-sm leading-relaxed text-[color:var(--fg-muted)]">
                        {profile.commission_info}
                      </p>
                    )}
                    {!isOwner && <MessageButton otherUserId={profile.id} label="Enquire" variant="solid" />}
                    {isOwner && (
                      <p className="text-xs text-muted-foreground">
                        Patrons see an Enquire button here.
                      </p>
                    )}
                  </aside>
                )}
              </div>
            </section>

            {/* Campaigns + studio updates — real feed cards, not a micro-rail */}
            {(resolvedCampaigns.length > 0 || studioUpdates.length > 0) && (
              <section id="updates" aria-label="Studio updates" className="border-t border-border">
                <ProfileUpdatesSection
                  campaigns={resolvedCampaigns}
                  updates={studioUpdates}
                  username={profile.username}
                />
              </section>
            )}

            {(showSupport || isOwner) && (
              <section id="support" aria-label="Support" className="border-t border-border">
                <SupportTab
                  supportEnabled={profile.support_enabled}
                  isOwner={isOwner}
                  artistName={displayName}
                  tiers={supportTiers}
                  userEmail={user?.email ?? undefined}
                  stripeConnected={profile.stripe_connect_status === "enabled"}
                />
              </section>
            )}
          </div>
        )}

        {/* ── Back link — artist profiles only; the partner/patron covers
               carry their own navigation ── */}
        {isArtistProfile && (
          <div className="border-t border-border pt-6 pb-12">
            <Link
              href="/artists"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to artists
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
