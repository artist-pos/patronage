import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getLatestUpdates } from "@/lib/feed";
import { getArtistProjects } from "@/lib/projects";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";
import { InfiniteFeed } from "@/components/feed/InfiniteFeed";
import { WorksJustifiedGrid } from "@/components/feed/WorksJustifiedGrid";
import { WorksControls } from "@/components/feed/WorksControls";
import { getAvailableWorksForGrid, type WorksSort } from "@/lib/works";

export const metadata: Metadata = {
  title: "Feed | Patronage",
  description: "Work in progress and available artworks from the Patronage community.",
  alternates: { canonical: "https://patronage.nz/feed" },
};

const INITIAL_COUNT = 10;

// v2 Explore is a visual feed (studio updates + available works). Artists,
// opportunities and articles each have a canonical browse surface — the
// filter tabs route there instead of re-rendering them as pin walls here.
const EXPLORE_FILTERS = ["all", "updates"] as const;
type ExploreFilter = (typeof EXPLORE_FILTERS)[number];

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    sort?: string;
    medium?: string;
    wlayout?: string;
    audience?: string;
    filter?: string;
  }>;
}

export default async function FeedPage({ searchParams }: PageProps) {
  const {
    tab = "feed",
    sort = "recent",
    medium,
    wlayout = "justified",
    audience = "everyone",
    filter: rawFilter = "all",
  } = await searchParams;

  const activeTab = tab === "works" ? "works" : "feed";
  const filter: ExploreFilter = (EXPLORE_FILTERS as readonly string[]).includes(rawFilter)
    ? (rawFilter as ExploreFilter)
    : "all";
  const worksLayout = wlayout === "list" ? "list" : "justified";
  const feedAudience =
    audience === "subscribed" ? "subscribed" : audience === "following" ? "following" : "everyone";

  const supabase = await createClient();

  const wantsUpdates = filter === "all" || filter === "updates";

  // Auth — request-deduped with the Header. Started here, awaited far below, so
  // the public queries that follow overlap it instead of queuing behind it.
  const authPromise = getServerUser();

  // The "everyone" feed is the one query that DOES depend on auth: signed-out
  // viewers get admin-moderated updates filtered out (migration 177), signed-in
  // viewers see everything. Chained off authPromise so it fires the moment the
  // user resolves, rather than waiting on the profile round-trip too.
  const everyoneFeedPromise =
    activeTab === "feed" && feedAudience === "everyone" && wantsUpdates
      ? authPromise.then(({ user }) => getLatestUpdates(INITIAL_COUNT, 0, undefined, !!user))
      : null;

  // ── Public queries — these don't depend on auth at all, so they start
  // immediately and run alongside the auth round-trip above.

  // ── Explore extras — available works thread through the update masonry so
  // the "All" feed stays visual: studio updates + art for sale, nothing else.
  const wantExtras = activeTab === "feed" && feedAudience === "everyone" && filter === "all";
  const explorePinsPromise: PromiseLike<import("@/components/feed/ExplorePinCards").ExplorePin[]> =
    wantExtras
      ? supabase
          .from("artworks")
          .select("id, url, thumb_url, title, year, edition, price_cents, price_currency, is_poa, hide_price, profile:profiles!profile_id(username, full_name)")
          .eq("is_available", true)
          .eq("hide_available", false)
          .not("url", "is", null)
          .order("created_at", { ascending: false })
          .limit(6)
          .then(({ data }) =>
            (data ?? []).map((w: any) => ({
              kind: "work" as const,
              id: w.id,
              url: w.url,
              thumb_url: w.thumb_url ?? null,
              title: w.title,
              year: w.year,
              edition: w.edition ?? null,
              price_cents: w.price_cents,
              price_currency: w.price_currency,
              is_poa: w.is_poa,
              hide_price: w.hide_price,
              artist_name: w.profile?.full_name ?? w.profile?.username ?? null,
              artist_username: w.profile?.username ?? null,
            }))
          )
      : Promise.resolve([]);

  // Available works for the "works" tab — shared query, also starts pre-auth.
  const worksPromise = activeTab === "works"
    ? getAvailableWorksForGrid({ medium, sort: sort as WorksSort })
    : Promise.resolve(null);

  // ── Resolve auth (started above, concurrent with the public queries) ──
  const { user } = await authPromise;
  const profile = user ? await getProfileById(user.id) : null;
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  const worksLayoutPromise = activeTab === "works"
    ? (isAdmin && user
        ? supabase
            .from("profiles")
            .select("works_row_height, works_h_gap, works_v_gap, works_last_row_align")
            .eq("id", user.id)
            .single()
            .then((r) => r.data)
        : supabase
            .from("profiles")
            .select("works_row_height, works_h_gap, works_v_gap, works_last_row_align")
            .in("role", ["admin", "owner"])
            .limit(1)
            .single()
            .then((r) => r.data))
    : Promise.resolve(null);

  // For subscribed/following feed, fetch the relevant artist IDs (in parallel with other queries)
  const subscribedArtistIdsPromise =
    activeTab === "feed" && feedAudience === "subscribed" && user
      ? supabase
          .from("support_subscriptions")
          .select("recipient_id")
          .eq("supporter_id", user.id)
          .in("status", ["active", "one_off_paid"])
          .then(({ data }) =>
            (data ?? []).map((s: { recipient_id: string }) => s.recipient_id).filter(Boolean)
          )
      : activeTab === "feed" && feedAudience === "following" && user
        ? supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id)
            .then(({ data }) =>
              (data ?? []).map((f: { following_id: string }) => f.following_id).filter(Boolean)
            )
        : Promise.resolve(undefined as string[] | undefined);

  const [userProjects, worksResult, worksLayoutData, subscribedArtistIds, explorePins] =
    await Promise.all([
      profile ? getArtistProjects(profile.id) : Promise.resolve([]),
      worksPromise,
      worksLayoutPromise,
      subscribedArtistIdsPromise,
      explorePinsPromise,
    ]);

  // Resolve feed updates — "everyone" was already in flight; "subscribed" needs the artist IDs first
  const feedUpdates =
    everyoneFeedPromise !== null
      ? await everyoneFeedPromise
      : activeTab === "feed" && feedAudience !== "everyone"
        // following/subscribed are signed-in-only audiences — no admin_hidden filter
        ? await getLatestUpdates(INITIAL_COUNT, 0, subscribedArtistIds, !!user)
        : [];

  const hasMore = activeTab === "feed" && feedUpdates.length === INITIAL_COUNT;
  const artworks = worksResult?.artworks ?? [];
  const mediumOptions = worksResult?.mediumOptions ?? [];

  // v2 filter tab — mono, teal active underline
  const tabCls = (active: boolean) =>
    `flex h-9 shrink-0 items-center whitespace-nowrap px-3.5 -mb-px border-b-2 font-mono text-xs transition-colors ${
      active
        ? "border-brand text-brand"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  // Explore tab set — All/Updates render here; the rest are the canonical
  // browse surfaces for each content type.
  const filterTabs: { label: string; href: string; active: boolean }[] = [
    { label: "All", href: "/feed", active: activeTab === "feed" && filter === "all" },
    { label: "Updates", href: "/feed?filter=updates", active: activeTab === "feed" && filter === "updates" },
    { label: "For sale", href: "/works", active: activeTab === "works" },
    { label: "Artists", href: "/artists", active: false },
    { label: "Opportunities", href: "/opportunities", active: false },
    { label: "Articles", href: "/blog", active: false },
  ];

  return (
    <div>
      {/* ── Page header + filter tabs ── */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pt-7 sm:px-6">
          <h1 className="mb-4 text-2xl font-semibold tracking-[-0.025em]">Explore</h1>
          <div className="flex items-stretch overflow-x-auto scrollbar-hide">
            {filterTabs.map((t) => (
              <Link key={t.label} href={t.href} className={tabCls(t.active)}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "feed" ? (
        /* Feed surface — figure-ground: pins sit on #EFEEEC */
        <div className="min-h-screen bg-feed-bg">
          <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
            <InfiniteFeed
              initialUpdates={feedUpdates}
              initialHasMore={hasMore}
              extraPins={explorePins}
              audience={feedAudience}
              isLoggedIn={!!user}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              rightSlot={
                profile ? (
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <Link
                        href="/studio?section=feed"
                        className="shrink-0 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Manage feed →
                      </Link>
                    )}
                    <CreateUpdateModal
                      profileId={profile.id}
                      label="New update +"
                      className="shrink-0 bg-foreground px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                      projects={userProjects.map((p) => ({ id: p.id, title: p.title }))}
                    />
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
          {/* Works controls row: count on left, controls + layout switcher on right */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="font-mono text-[11px] text-muted-foreground">
              {artworks.length} work{artworks.length !== 1 ? "s" : ""} available
            </p>
            <Suspense>
              <WorksControls
                mediumOptions={mediumOptions}
                currentSort={sort}
                currentMedium={medium}
                currentLayout={worksLayout}
              />
            </Suspense>
          </div>
          <Suspense>
            <WorksJustifiedGrid
              artworks={artworks}
              isAdmin={isAdmin}
              initialRowH={worksLayoutData?.works_row_height ?? undefined}
              initialHGap={worksLayoutData?.works_h_gap ?? undefined}
              initialVGap={worksLayoutData?.works_v_gap ?? undefined}
              initialLastRowAlign={(worksLayoutData?.works_last_row_align as "left" | "center" | "right") ?? undefined}
              layout={worksLayout}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
