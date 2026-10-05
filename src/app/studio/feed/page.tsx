import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getArtistUpdates } from "@/lib/feed";
import { getArtistProjects } from "@/lib/projects";
import { getMyWrittenNotes } from "@/lib/notes";
import { FeedTabsClient } from "@/components/studio/FeedTabsClient";
import type { Metadata } from "next";
import type { ProjectUpdateWithArtist, Project } from "@/types/database";

export const metadata: Metadata = { title: "Studio Feed — Studio" };

interface PageProps {
  searchParams: Promise<{ ft?: string }>;
}

export default async function StudioFeedPage({ searchParams }: PageProps) {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const FEED_TABS = ["updates", "projects", "notes"] as const;
  type FeedTab = typeof FEED_TABS[number];
  const initialFeedTab: FeedTab = (FEED_TABS as readonly string[]).includes(params.ft ?? "")
    ? (params.ft as FeedTab)
    : "updates";

  const [studioUpdates, studioProjects, feedArtworksResult, feedNotes] = await Promise.all([
    getArtistUpdates(user.id),
    getArtistProjects(user.id),
    supabase
      .from("artworks")
      .select("id, title, caption")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false }),
    getMyWrittenNotes(user.id),
  ]);

  const feedArtworks = ((feedArtworksResult as { data: { id: string; title: string | null; caption: string | null }[] | null } | null)?.data ?? [])
    .map((a) => ({ id: a.id, label: a.title ?? a.caption ?? "Untitled" }));

  return (
    <FeedTabsClient
      initialTab={initialFeedTab}
      artistUsername={profileRow?.username ?? ""}
      profileId={user.id}
      studioUpdates={studioUpdates as ProjectUpdateWithArtist[]}
      studioProjects={studioProjects as Project[]}
      feedArtworks={feedArtworks}
      feedNotes={feedNotes}
    />
  );
}
