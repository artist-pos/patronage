import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { getLatestUpdates } from "@/lib/feed";
import { getArtistProjects } from "@/lib/projects";
import { CreateUpdateModal } from "@/components/feed/CreateUpdateModal";
import { InfiniteFeed } from "@/components/feed/InfiniteFeed";
import { WorksJustifiedGrid } from "@/components/feed/WorksJustifiedGrid";
import { WorksControls } from "@/components/feed/WorksControls";
import type { ArtworkForGrid, EditionOption } from "@/components/feed/WorksJustifiedGrid";

export const metadata: Metadata = {
  title: "Feed | Patronage",
  description: "Work in progress and available artworks from the Patronage community.",
  alternates: { canonical: "https://patronage.nz/feed" },
};

const INITIAL_COUNT = 10;

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    sort?: string;
    medium?: string;
    wlayout?: string;
    audience?: string;
  }>;
}

export default async function FeedPage({ searchParams }: PageProps) {
  const {
    tab = "feed",
    sort = "recent",
    medium,
    wlayout = "justified",
    audience = "everyone",
  } = await searchParams;

  const activeTab = tab === "works" ? "works" : "feed";
  const worksLayout = wlayout === "list" ? "list" : "justified";
  const feedAudience =
    audience === "subscribed" ? "subscribed" : audience === "following" ? "following" : "everyone";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  // Start the feed fetch early for "everyone" — runs in parallel with other queries below
  const everyoneFeedPromise =
    activeTab === "feed" && feedAudience === "everyone"
      ? getLatestUpdates(INITIAL_COUNT, 0, undefined)
      : null;

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

  const [userProjects, worksResult, worksLayoutData, subscribedArtistIds] =
    await Promise.all([
      profile ? getArtistProjects(profile.id) : Promise.resolve([]),
      activeTab === "works"
        ? (async () => {
            let q = supabase
              .from("artworks")
              .select(
                "id, url, thumb_url, title, caption, description, year, dimensions, ledger_id, price_cents, is_poa, price_currency, medium, hide_price, listing_mode, acquisition_mode, location_text, show_location_publicly, created_at, profile:profiles!profile_id(id, username, full_name, avatar_url)"
              )
              .eq("is_available", true)
              .eq("hide_available", false);

            if (medium) q = (q as typeof q).contains("medium_category", [medium]);

            if (sort === "price_asc") {
              q = (q as typeof q)
                .order("price_cents", { ascending: true, nullsFirst: false })
                .order("created_at", { ascending: false });
            } else if (sort === "price_desc") {
              q = (q as typeof q)
                .order("price_cents", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false });
            } else {
              q = (q as typeof q).order("created_at", { ascending: false });
            }

            const [artworksRes, mediumsRes] = await Promise.all([
              q,
              supabase
                .from("artworks")
                .select("medium_category")
                .eq("is_available", true)
                .eq("hide_available", false)
                .not("medium_category", "is", null),
            ]);

            const artworkRows = artworksRes.data ?? [];
            const artworkIds = artworkRows.map((a: { id: string }) => a.id);

            const editionsRes = artworkIds.length > 0
              ? await supabase
                  .from("editions")
                  .select("id, work_id, label, type, price_cents, currency, poa, listing_mode, listed, sort_order, dimensions")
                  .in("work_id", artworkIds)
                  .eq("listed", true)
              : { data: [] };

            const editionsByWork = new Map<string, EditionOption[]>();
            for (const ed of editionsRes.data ?? []) {
              const key = (ed as { work_id: string }).work_id;
              if (!editionsByWork.has(key)) editionsByWork.set(key, []);
              editionsByWork.get(key)!.push({
                id: (ed as { id: string }).id,
                label: (ed as { label: string | null }).label ?? "",
                type: (ed as { type: string | null }).type ?? "",
                price_cents: (ed as { price_cents: number | null }).price_cents,
                currency: ((ed as { currency: string | null }).currency) ?? "NZD",
                poa: (ed as { poa: boolean | null }).poa ?? false,
                listing_mode: (ed as { listing_mode: string | null }).listing_mode ?? "",
                listed: (ed as { listed: boolean | null }).listed ?? false,
                sort_order: (ed as { sort_order: number | null }).sort_order ?? 0,
                dimensions: (ed as { dimensions: string | null }).dimensions,
              });
            }

            const artworks = artworkRows.map((a: Record<string, unknown>) => ({
              ...a,
              editions: editionsByWork.get(a.id as string) ?? [],
            })) as unknown as ArtworkForGrid[];

            const mediumOptions = [
              ...new Set(
                (mediumsRes.data ?? [])
                  .flatMap((r: { medium_category: string[] | null }) => r.medium_category ?? [])
                  .filter(Boolean)
              ),
            ].sort();

            return { artworks, mediumOptions };
          })()
        : Promise.resolve(null),
      worksLayoutPromise,
      subscribedArtistIdsPromise,
    ]);

  // Resolve feed updates — "everyone" was already in flight; "subscribed" needs the artist IDs first
  const feedUpdates =
    everyoneFeedPromise !== null
      ? await everyoneFeedPromise
      : activeTab === "feed"
        ? await getLatestUpdates(INITIAL_COUNT, 0, subscribedArtistIds)
        : [];

  const hasMore = activeTab === "feed" && feedUpdates.length === INITIAL_COUNT;
  const artworks = worksResult?.artworks ?? [];
  const mediumOptions = worksResult?.mediumOptions ?? [];

  const tabCls = (t: string) =>
    `flex flex-col items-start px-4 pb-2.5 pt-2 transition-colors border-b-2 ${
      activeTab === t
        ? "border-black text-foreground -mb-px"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-stone-200">
        <Link href="/feed" className={tabCls("feed")}>
          <span className="text-2xl font-semibold tracking-tight">Feed</span>
          <span className="text-[10px] text-stone-400">studio updates</span>
        </Link>
        <Link href="/works" className={tabCls("works")}>
          <span className="text-2xl font-semibold tracking-tight">Works</span>
          <span className="text-[10px] text-stone-400">for sale</span>
        </Link>
      </div>

      {activeTab === "feed" ? (
        <InfiniteFeed
          initialUpdates={feedUpdates}
          initialHasMore={hasMore}
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
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
                  >
                    Manage feed →
                  </Link>
                )}
                <CreateUpdateModal
                  profileId={profile.id}
                  label="New update +"
                  className="shrink-0 px-6 py-2 border border-black text-sm hover:bg-black hover:text-white transition-colors"
                  projects={userProjects.map((p) => ({ id: p.id, title: p.title }))}
                />
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Works controls row: count on left, controls + layout switcher on right */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground">
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
