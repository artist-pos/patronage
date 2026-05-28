"use client";

import { useState } from "react";
import Link from "next/link";
import { WorksTable, type SeriesRow } from "@/components/dashboard/WorksTable";

type WorksTab = "archival" | "for-sale" | "sold";

interface Props {
  initialTab: WorksTab;
  profileId: string;
  profileComplete: boolean;
  missingFields: { key: string; label: string; href: string }[];
  portfolioWorks: Parameters<typeof WorksTable>[0]["portfolioWorks"];
  availableWorks: Parameters<typeof WorksTable>[0]["availableWorks"];
  soldWorks: Parameters<typeof WorksTable>[0]["soldWorks"];
  featuredCount: number;
  engagementMap: Record<string, { view: number; play: number }>;
  pendingConfirmationCount: number;
  seriesList: Array<{ id: string; title: string; slug: string; hero_image_url: string | null; artworkCount: number; is_featured: boolean; position: number }>;
}

export function WorksTabsClient({
  initialTab, profileId, profileComplete, missingFields,
  portfolioWorks, availableWorks, soldWorks, featuredCount,
  engagementMap, pendingConfirmationCount, seriesList,
}: Props) {
  const [tab, setTab] = useState<WorksTab>(initialTab);

  function switchTab(t: WorksTab) {
    setTab(t);
    window.history.replaceState(null, "", `/studio?section=works&wt=${t}`);
  }

  // Merge series into archival list, sorted by position
  const seriesItems: SeriesRow[] = seriesList.map(s => ({
    _kind: "series" as const,
    id: s.id,
    title: s.title,
    hero_image_url: s.hero_image_url,
    artworkCount: s.artworkCount,
    is_featured: s.is_featured,
    position: s.position,
  }));
  const mergedPortfolio = [...seriesItems, ...portfolioWorks]
    .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));

  return (
    <div className="space-y-6">
      {pendingConfirmationCount > 0 && (
        <div className="flex items-center justify-between border border-amber-200 bg-amber-50 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">{pendingConfirmationCount}</span> work{pendingConfirmationCount !== 1 ? "s" : ""} need attribution confirmation.
          </p>
          <Link href="/studio/pending-confirmations" className="text-sm text-amber-900 underline underline-offset-2 shrink-0 ml-4">
            Review →
          </Link>
        </div>
      )}

      <div className="flex gap-0 border-b border-border">
        {(["archival", "for-sale", "sold"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
              tab === t
                ? "font-medium border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "archival" ? "Archival" : t === "for-sale" ? "Sell" : "Sold"}
          </button>
        ))}
      </div>

      {tab === "archival" && (
        <div className="space-y-6">
          {(featuredCount > 0 || mergedPortfolio.length > 0) && (
            <div className="flex items-center justify-between text-xs text-muted-foreground border border-border px-4 py-2.5">
              <span>
                <span className="font-semibold text-foreground">{featuredCount}</span> of 8 works featured
                {featuredCount > 0 && " — shown on your profile overview"}
              </span>
              {featuredCount === 0 && (
                <span>Star any work or series to feature it on your profile overview.</span>
              )}
            </div>
          )}

          <WorksTable
            section="portfolio"
            portfolioWorks={mergedPortfolio}
            availableWorks={availableWorks}
            soldWorks={soldWorks}
            featuredCount={featuredCount}
            profileId={profileId}
            engagementMap={engagementMap}
          />
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <Link
                href="/studio/works/new"
                className="text-sm border border-border px-4 py-2 hover:bg-muted/40 transition-colors inline-block"
              >
                + Add work
              </Link>
              <Link
                href="/studio/series/new"
                className="text-sm border border-border px-4 py-2 hover:bg-muted/40 transition-colors inline-block"
              >
                + New series
              </Link>
            </div>
          </div>
        </div>
      )}

      {tab === "for-sale" && (
        <div className="space-y-6">
          {!profileComplete && missingFields.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-amber-900">Your listed works aren&apos;t publicly visible yet.</p>
              <p className="text-sm text-amber-800">
                Complete your profile to show works for sale. Add:{" "}
                {missingFields.map((f, i) => (
                  <span key={f.key}>
                    {i > 0 && ", "}
                    <a href={f.href} className="underline underline-offset-2 hover:text-amber-950 transition-colors">{f.label}</a>
                  </span>
                ))}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Works listed for sale. Patrons can make offers directly from your profile.</p>
            <div className="flex items-center gap-2">
              <Link
                href="/studio/works/new?mode=sale"
                className="text-xs border border-border px-3 py-1.5 hover:bg-muted/40 transition-colors font-medium"
              >
                + Log a sale
              </Link>
              <Link
                href="/studio/works/new?mode=list"
                className="text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity font-medium"
              >
                + Add Available Work
              </Link>
            </div>
          </div>
          <WorksTable
            section="available"
            portfolioWorks={portfolioWorks}
            availableWorks={availableWorks}
            soldWorks={soldWorks}
            featuredCount={featuredCount}
            profileId={profileId}
          />
        </div>
      )}

      {tab === "sold" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Works transferred to collectors. These are permanent provenance records.</p>
            <Link
              href="/studio/works/new?mode=sale"
              className="text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity font-medium"
            >
              + Log a sale
            </Link>
          </div>
          <WorksTable
            section="sold"
            portfolioWorks={portfolioWorks}
            availableWorks={availableWorks}
            soldWorks={soldWorks}
            featuredCount={featuredCount}
            profileId={profileId}
          />
        </div>
      )}


    </div>
  );
}
