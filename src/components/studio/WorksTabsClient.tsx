"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { WorksTable } from "@/components/dashboard/WorksTable";
import { SeriesTab } from "@/components/studio/SeriesTab";
import { toggleSeriesFeatured } from "@/app/studio/series/actions";

type WorksTab = "archival" | "for-sale" | "sold" | "series";

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
  seriesList: Array<{ id: string; title: string; slug: string; hero_image_url: string | null; artworkCount: number; is_featured: boolean }>;
}

export function WorksTabsClient({
  initialTab, profileId, profileComplete, missingFields,
  portfolioWorks, availableWorks, soldWorks, featuredCount,
  engagementMap, pendingConfirmationCount, seriesList,
}: Props) {
  const [tab, setTab] = useState<WorksTab>(initialTab);
  const [localSeries, setLocalSeries] = useState(seriesList);
  const [, startTransition] = useTransition();

  function switchTab(t: WorksTab) {
    setTab(t);
    window.history.replaceState(null, "", `/studio?section=works&wt=${t}`);
  }

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
        {(["archival", "for-sale", "sold", "series"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
              tab === t
                ? "font-medium border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "archival" ? "Archival" : t === "for-sale" ? "Sell" : t === "sold" ? "Sold" : "Series"}
          </button>
        ))}
      </div>

      {tab === "archival" && (
        <div className="space-y-6">
          {(featuredCount > 0 || portfolioWorks.length > 0 || localSeries.length > 0) && (
            <div className="flex items-center justify-between text-xs text-muted-foreground border border-border px-4 py-2.5">
              <span>
                <span className="font-semibold text-foreground">{featuredCount}</span> of 8 works featured
                {featuredCount > 0 && " — shown on your profile overview"}
              </span>
              {featuredCount === 0 && (
                <span>Open any work and mark it as Featured to curate your overview.</span>
              )}
            </div>
          )}

          {/* Series section */}
          {localSeries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Series</p>
              <div className="divide-y divide-border border border-border">
                {localSeries.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-10 h-10 shrink-0 overflow-hidden bg-stone-100">
                      {s.hero_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.hero_image_url} alt={s.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-stone-200" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.artworkCount} {s.artworkCount === 1 ? "work" : "works"}</p>
                    </div>
                    <button
                      title={s.is_featured ? "Remove from profile overview" : "Feature on profile overview"}
                      onClick={() => {
                        const next = !s.is_featured;
                        setLocalSeries(prev => prev.map(x => x.id === s.id ? { ...x, is_featured: next } : x));
                        startTransition(() => { toggleSeriesFeatured(s.id, next); });
                      }}
                      className={`shrink-0 p-1 transition-colors ${s.is_featured ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill={s.is_featured ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                        <polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,12 3.5,15 5,9.5 1,6 6,6" />
                      </svg>
                    </button>
                    <Link
                      href={`/studio/series/${s.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      Edit →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <WorksTable
            section="portfolio"
            portfolioWorks={portfolioWorks}
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

      {tab === "series" && (
        <SeriesTab series={seriesList} />
      )}

    </div>
  );
}
