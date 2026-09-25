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
import { getSellableSellerIds } from "@/lib/commerce/eligibility";
import { getCitiesWithRegions } from "@/lib/regions";
import { TrackedNavLink } from "@/components/analytics/TrackedNavLink";
import { JoinButton } from "@/components/auth/JoinButton";
import type { JoinCity } from "@/components/auth/JoinModal";

/**
 * Explore: studio updates and work for sale as two tabs of one page. Rendered
 * by /feed ("Studio updates") and /works ("For sale") so each tab keeps its own
 * URL, title and search presence while sharing the header, tabs and join
 * prompt. Not a route itself — the page files pick the tab.
 */

const INITIAL_COUNT = 10;

// One available work as the Explore pin query returns it.
interface PinWorkRow {
  id: string;
  url: string;
  thumb_url: string | null;
  title: string | null;
  year: number | null;
  edition: string | null;
  price_cents: number | null;
  price_currency: string | null;
  is_poa: boolean | null;
  hide_price: boolean | null;
  profile: { id: string; username: string | null; full_name: string | null } | null;
}

// v2 Explore is a visual feed (studio updates + available works). Artists,
// opportunities and articles each have a canonical browse surface — the
// filter tabs route there instead of re-rendering them as pin walls here.
const EXPLORE_FILTERS = ["all", "updates"] as const;
type ExploreFilter = (typeof EXPLORE_FILTERS)[number];

export interface ExploreParams {
  sort?: string;
  medium?: string;
  wlayout?: string;
  audience?: string;
  filter?: string;
}

export async function ExploreView({ tab, params }: { tab: "feed" | "works"; params: ExploreParams }) {
  const {
    sort = "recent",
    medium,
    wlayout = "justified",
    audience = "everyone",
    filter: rawFilter = "all",
  } = params;

  const activeTab = tab;
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
  // Taxonomy, cached for a day; only signed-out visitors (the join popup) use it.
  const citiesPromise = getCitiesWithRegions();

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
          .select("id, url, thumb_url, title, year, edition, price_cents, price_currency, is_poa, hide_price, profile:profiles!profile_id(id, username, full_name)")
          .eq("is_available", true)
          .eq("hide_available", false)
          .not("url", "is", null)
          .order("created_at", { ascending: false })
          // Over-fetch, then keep only sellers who can be paid, then take 6.
          .limit(30)
          .then(async ({ data }) => {
            const rows = (data ?? []) as unknown as PinWorkRow[];
            const sellable = await getSellableSellerIds(rows.map((w) => w.profile?.id ?? ""));
            return rows.filter((w) => w.profile && sellable.has(w.profile.id)).slice(0, 6);
          })
          .then((data) =>
            data.map((w) => ({
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
  // Only the fields the popup’s town search reads cross to the client.
  const joinCities: JoinCity[] = user
    ? []
    : (await citiesPromise).map((c) => ({
        id: c.id,
        name: c.name,
        name_maori: c.name_maori,
        aliases: c.aliases,
        is_major: c.is_major,
        region_id: c.region_id,
        region: c.region ? { id: c.region.id, name: c.region.name } : null,
      }));
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

  // Same underline tabs as /opportunities: sans, black 2px underline.
  const tabCls = (active: boolean) =>
    `relative flex h-12 shrink-0 items-center whitespace-nowrap text-[14px] font-medium tracking-[-0.01em] transition-colors ${
      active
        ? "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-foreground"
        : "text-[color:var(--fg-muted)] hover:text-foreground"
    }`;

  // Explore is just these two surfaces — updates and work for sale. Artists,
  // Opportunities and Articles already have their own primary nav entries;
  // listing them again here was what forced this row to scroll on mobile.
  const filterTabs: { label: string; href: string; active: boolean }[] = [
    { label: "Studio updates", href: "/feed", active: activeTab === "feed" },
    { label: "For sale", href: "/works", active: activeTab === "works" },
  ];

  return (
    <div>
      {/* ── Page header + filter tabs ── */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-4 pt-7 sm:px-6 sm:pt-9">
          <h1 className="t-display text-[32px] sm:text-[40px]">Explore</h1>
          <p className="mt-2 max-w-[560px] text-[14.5px] leading-[1.55] text-[color:var(--fg-muted)]">
            Studio updates and new work from artists in Aotearoa and beyond.
          </p>
          <div className="mt-4 flex items-stretch gap-6 overflow-x-auto scrollbar-hide">
            {filterTabs.map((t) => (
              <TrackedNavLink
                key={t.label}
                href={t.href}
                event="explore_tab_click"
                props={{ tab: t.href.includes("works") ? "for_sale" : "studio_updates" }}
                className={tabCls(t.active)}
              >
                {t.label}
              </TrackedNavLink>
            ))}
            {/* Signed-out: the way in sits at the end of the tab row, never
                inside the masonry. Opens the join popup in place. */}
            {!user && (
              <div className="ml-auto flex shrink-0 items-center gap-4 self-center">
                <p className="hidden text-[13px] text-[color:var(--fg-muted)] md:block">
                  Follow artists and back the ones you believe in.
                </p>
                <JoinButton
                  cities={joinCities}
                  source="explore_tabs"
                  className="shrink-0 bg-brand px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                >
                  Join free →
                </JoinButton>
              </div>
            )}
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
              basePath="/feed"
              variant="v2"
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
                basePath="/works"
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
