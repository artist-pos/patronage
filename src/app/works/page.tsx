import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getAvailableWorksForGrid, type WorksSort } from "@/lib/works";
import { WorksJustifiedGrid } from "@/components/feed/WorksJustifiedGrid";
import { WorksControls } from "@/components/feed/WorksControls";

export const metadata: Metadata = {
  title: {
    absolute: "Original Art for Sale NZ | Paintings & Works by NZ Artists | Patronage",
  },
  description:
    "Browse and buy original artwork from New Zealand artists. Paintings, mixed media, sculpture and more. Every purchase supports the artist directly through Patronage.",
  alternates: { canonical: "https://patronage.nz/works" },
  openGraph: {
    title: "Original Art for Sale NZ | Patronage",
    description:
      "Browse and buy original artwork from New Zealand artists. Paintings, mixed media, sculpture and more — every purchase supports the artist directly.",
    type: "website",
  },
};

interface PageProps {
  searchParams: Promise<{ sort?: string; medium?: string; wlayout?: string }>;
}

export default async function WorksPage({ searchParams }: PageProps) {
  const { sort: rawSort = "recent", medium, wlayout = "justified" } = await searchParams;
  const sort: WorksSort =
    rawSort === "price_asc" || rawSort === "price_desc" ? rawSort : "recent";
  const worksLayout = wlayout === "list" ? "list" : "justified";

  // Public grid data — starts immediately, before the auth round-trip.
  const worksPromise = getAvailableWorksForGrid({ medium, sort });

  // Request-deduped auth — shares the Header's round-trip.
  const { supabase, user } = await getServerUser();
  const profile = user ? await getProfileById(user.id) : null;
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  const layoutPromise =
    isAdmin && user
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
          .then((r) => r.data);

  const [{ artworks, mediumOptions }, layout] = await Promise.all([worksPromise, layoutPromise]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-8 sm:px-6">
      {/* ── SEO header — server-rendered, indexable ── */}
      <header className="max-w-3xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Original art for sale</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Original art for sale by New Zealand artists. Browse paintings, mixed media, sculpture,
          and more from emerging and established artists across Aotearoa. Every purchase supports
          the artist directly.
        </p>
      </header>

      {/* Controls row: count on left, filters + layout switcher on right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          initialRowH={layout?.works_row_height ?? undefined}
          initialHGap={layout?.works_h_gap ?? undefined}
          initialVGap={layout?.works_v_gap ?? undefined}
          initialLastRowAlign={(layout?.works_last_row_align as "left" | "center" | "right") ?? undefined}
          layout={worksLayout}
        />
      </Suspense>
    </div>
  );
}
