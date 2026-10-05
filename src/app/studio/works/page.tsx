import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getMissingFields, isProfileComplete } from "@/lib/profile-completion";
import { fetchCompletionProfile } from "@/lib/profile-completion.server";
import { getPendingConfirmationCount } from "@/lib/pending-confirmations";
import { WorksTabsClient } from "@/components/studio/WorksTabsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Works — Studio" };

interface PageProps {
  searchParams: Promise<{ wf?: string; view?: string }>;
}

export default async function StudioWorksPage({ searchParams }: PageProps) {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;

  const [{ data: profileRow }, completionProfile] = await Promise.all([
    supabase
      .from("profiles")
      .select("stripe_connect_status, stripe_account_id")
      .eq("id", user.id)
      .single(),
    fetchCompletionProfile(user.id),
  ]);

  const missingFields = completionProfile ? getMissingFields(completionProfile) : [];
  const profileComplete = completionProfile ? isProfileComplete(completionProfile) : false;

  const WORKS_FILTERS = ["all", "for-sale", "sold", "featured", "archival"] as const;
  type WorksFilter = typeof WORKS_FILTERS[number];
  const initialWorksFilter: WorksFilter = (WORKS_FILTERS as readonly string[]).includes(params.wf ?? "")
    ? (params.wf as WorksFilter)
    : "all";
  const initialWorksView: "list" | "grid" = params.view === "grid" ? "grid" : "list";

  const [worksResult, featuredRows, engagementRows, pendingConfirmationCount, seriesResult, seriesArtworkIdsResult] =
    await Promise.all([
      supabase
        .from("artworks")
        .select("id, url, caption, description, title, year, medium, dimensions, content_type, price_cents, is_poa, price_currency, is_available, is_featured, hide_available, hide_price, hide_from_archive, position, created_at, current_owner_id, hidden_from_artist, ledger_id, editions(id, type)")
        .eq("creator_id", user.id)
        .neq("source", "holder_uploaded")
        .order("position", { ascending: true }),
      supabase
        .from("artworks")
        .select("id, is_featured")
        .eq("creator_id", user.id)
        .eq("is_featured", true),
      supabase
        .from("artworks")
        .select("id")
        .eq("creator_id", user.id)
        .then(async ({ data: pids }) => {
          const ids = (pids ?? []).map((r: { id: string }) => r.id);
          if (!ids.length) return { data: [] };
          return supabase.from("engagement_logs").select("work_id, event_type").in("work_id", ids);
        }),
      getPendingConfirmationCount(user.id),
      supabase
        .from("series")
        .select("id, title, slug, hero_image_url, is_featured, position, series_artworks(count)")
        .eq("artist_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("series")
        .select("series_artworks(artwork_id)")
        .eq("artist_id", user.id)
        .then(({ data }) =>
          new Set(
            (data ?? []).flatMap(s =>
              (s.series_artworks as { artwork_id: string }[]).map(sa => sa.artwork_id)
            )
          )
        ),
    ]);

  const featuredIds = new Set(
    ((featuredRows as { data: { id: string }[] | null } | null)?.data ?? []).map((r) => r.id)
  );
  const seriesArtworkIds = (seriesArtworkIdsResult as Set<string> | null) ?? new Set<string>();

  type StudioWorkStatus = "archival" | "for-sale" | "sold";
  type RawWork = Record<string, unknown> & {
    id: string; current_owner_id: string; is_available: boolean;
    editions: { id: string; type: string }[] | null;
  };
  const works = ((worksResult as { data: RawWork[] | null } | null)?.data ?? [])
    .map((w) => {
      const sold = w.current_owner_id !== user.id;
      const status: StudioWorkStatus = sold ? "sold" : (w.is_available ? "for-sale" : "archival");
      return { ...w, status, is_featured: featuredIds.has(w.id) };
    })
    .filter((w) => {
      if (w.status === "sold") {
        const eds = w.editions ?? [];
        if (eds.length > 0 && !eds.every((e) => e.type === "original")) return false;
      }
      if (w.status === "archival" && seriesArtworkIds.has(w.id)) return false;
      return true;
    });

  const seriesList = ((seriesResult as { data: Array<{ id: string; title: string; slug: string; hero_image_url: string | null; is_featured: boolean; position: number; series_artworks: Array<{ count: number }> }> | null } | null)?.data ?? []).map(s => ({
    id: s.id, title: s.title, slug: s.slug, hero_image_url: s.hero_image_url,
    is_featured: s.is_featured, position: s.position,
    artworkCount: (s.series_artworks as unknown as [{ count: number }])?.[0]?.count ?? 0,
  }));

  const engagementMap: Record<string, { view: number; play: number }> = {};
  for (const row of ((engagementRows as { data: { work_id: string; event_type: string }[] | null } | null)?.data ?? [])) {
    if (!engagementMap[row.work_id]) engagementMap[row.work_id] = { view: 0, play: 0 };
    if (row.event_type === "view") engagementMap[row.work_id].view++;
    if (row.event_type === "play") engagementMap[row.work_id].play++;
  }

  return (
    <WorksTabsClient
      initialView={initialWorksView}
      initialFilter={initialWorksFilter}
      profileComplete={profileComplete}
      missingFields={missingFields}
      works={works as unknown as Parameters<typeof WorksTabsClient>[0]["works"]}
      featuredCount={featuredIds.size}
      engagementMap={engagementMap}
      pendingConfirmationCount={pendingConfirmationCount}
      seriesList={seriesList}
      stripeConnectEnabled={
        profileRow?.stripe_connect_status === "enabled" && !!profileRow?.stripe_account_id
      }
    />
  );
}
