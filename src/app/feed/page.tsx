import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ExploreView, type ExploreParams } from "./ExploreView";

export const metadata: Metadata = {
  title: "Explore",
  description: "Studio updates and new work from artists in Aotearoa and beyond.",
  alternates: { canonical: "https://patronage.nz/feed" },
};

interface PageProps {
  searchParams: Promise<ExploreParams & { tab?: string }>;
}

// Explore's "Studio updates" tab. "For sale" lives at /works.
export default async function FeedPage({ searchParams }: PageProps) {
  const { tab, ...params } = await searchParams;

  // The old in-page works tab: send it to the For sale tab's own URL.
  if (tab === "works") {
    const q = new URLSearchParams();
    if (params.sort) q.set("sort", params.sort);
    if (params.medium) q.set("medium", params.medium);
    if (params.wlayout) q.set("wlayout", params.wlayout);
    permanentRedirect(q.size ? `/works?${q}` : "/works");
  }

  return <ExploreView tab="feed" params={params} />;
}
