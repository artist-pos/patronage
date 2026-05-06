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
import type { ArtworkForGrid } from "@/components/feed/WorksJustifiedGrid";

export const metadata: Metadata = {
  title: "Feed | Patronage",
  description: "Work in progress and available artworks from the Patronage community.",
};

const INITIAL_COUNT = 10;

interface PageProps {
  searchParams: Promise<{ tab?: string; sort?: string; medium?: string }>;
}

export default async function FeedPage({ searchParams }: PageProps) {
  const { tab = "feed", sort = "recent", medium } = await searchParams;
  const activeTab = tab === "works" ? "works" : "feed";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getProfileById(user.id) : null;
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  // Fetch saved works layout. Admin reads from their own profile (the one saves go to).
  // Non-admins read from whichever admin/owner profile holds the setting.
  const worksLayoutPromise = activeTab === "works"
    ? (isAdmin && user
        ? supabase
            .from("profiles")
            .select("works_row_height, works_h_gap, works_v_gap")
            .eq("id", user.id)
            .single()
            .then((r) => r.data)
        : supabase
            .from("profiles")
            .select("works_row_height, works_h_gap, works_v_gap")
            .in("role", ["admin", "owner"])
            .limit(1)
            .single()
            .then((r) => r.data))
    : Promise.resolve(null);

  const [updatesResult, userProjects, worksResult, worksLayout] = await Promise.all([
    activeTab === "feed" ? getLatestUpdates(INITIAL_COUNT) : Promise.resolve(null),
    profile ? getArtistProjects(profile.id) : Promise.resolve([]),
    activeTab === "works"
      ? (async () => {
          let q = supabase
            .from("artworks")
            .select("id, url, title, caption, price_cents, is_poa, price_currency, medium, hide_price, created_at, profile:profiles!profile_id(username, full_name, avatar_url)")
            .eq("is_available", true)
            .eq("hide_available", false);

          if (medium) q = (q as typeof q).contains("medium_category", [medium]);

          if (sort === "price_asc") {
            q = (q as typeof q).order("price_cents", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
          } else if (sort === "price_desc") {
            q = (q as typeof q).order("price_cents", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
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

          const mediumOptions = [
            ...new Set(
              (mediumsRes.data ?? [])
                .flatMap((r: { medium_category: string[] | null }) => r.medium_category ?? [])
                .filter(Boolean)
            ),
          ].sort();

          return { artworks: (artworksRes.data ?? []) as unknown as ArtworkForGrid[], mediumOptions };
        })()
      : Promise.resolve(null),
    worksLayoutPromise,
  ]);

  const updates = updatesResult ?? [];
  const hasMore = activeTab === "feed" && updates.length === INITIAL_COUNT;
  const artworks = worksResult?.artworks ?? [];
  const mediumOptions = worksResult?.mediumOptions ?? [];

  const tabCls = (t: string) =>
    `px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
      activeTab === t
        ? "border-b-2 border-black text-foreground -mb-px"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-8">

      {/* Tab bar — first */}
      <div className="flex gap-0 border-b border-black">
        <Link href="/feed" className={tabCls("feed")}>Feed</Link>
        <Link href="/feed?tab=works" className={tabCls("works")}>Works</Link>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {activeTab === "feed" ? "Feed" : "Works"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === "feed"
              ? "Work in progress from the Patronage community."
              : "Available works from Patronage artists."}
          </p>
        </div>
        {activeTab === "feed" && profile && (
          <CreateUpdateModal
            profileId={profile.id}
            label="New update +"
            className="shrink-0 px-6 py-2 border border-black text-sm hover:bg-black hover:text-white transition-colors"
            projects={userProjects.map((p) => ({ id: p.id, title: p.title }))}
          />
        )}
      </div>

      {activeTab === "feed" ? (
        <InfiniteFeed initialUpdates={updates} initialHasMore={hasMore} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {artworks.length} work{artworks.length !== 1 ? "s" : ""} available
            </p>
            <Suspense>
              <WorksControls
                mediumOptions={mediumOptions}
                currentSort={sort}
                currentMedium={medium}
              />
            </Suspense>
          </div>
          <WorksJustifiedGrid
            artworks={artworks}
            isAdmin={isAdmin}
            initialRowH={worksLayout?.works_row_height ?? undefined}
            initialHGap={worksLayout?.works_h_gap ?? undefined}
            initialVGap={worksLayout?.works_v_gap ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
