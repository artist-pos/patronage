"use client";

import { useState } from "react";
import Link from "next/link";
import { WorksTable } from "@/components/dashboard/WorksTable";
import { AddWorkButton } from "@/components/dashboard/AddWorkButton";
import { AddPortfolioWorkButton } from "@/components/dashboard/AddPortfolioWorkButton";

type WorksTab = "archival" | "for-sale" | "sold" | "collected";

interface CollectedWork {
  id: string; url: string; caption: string | null;
  price: number | null; price_currency: string | null;
  creator_id: string; created_at: string;
}

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
  collectedWorks: CollectedWork[];
}

export function WorksTabsClient({
  initialTab, profileId, profileComplete, missingFields,
  portfolioWorks, availableWorks, soldWorks, featuredCount,
  engagementMap, pendingConfirmationCount, collectedWorks,
}: Props) {
  const [tab, setTab] = useState<WorksTab>(initialTab);

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
        {(["archival", "for-sale", "sold", "collected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
              tab === t
                ? "font-medium border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "archival" ? "Archival" : t === "for-sale" ? "For Sale" : t === "sold" ? "Sold" : "Collected"}
          </button>
        ))}
      </div>

      {tab === "archival" && (
        <div className="space-y-6">
          {(featuredCount > 0 || portfolioWorks.length > 0) && (
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
          <WorksTable
            section="portfolio"
            portfolioWorks={portfolioWorks}
            availableWorks={availableWorks}
            soldWorks={soldWorks}
            featuredCount={featuredCount}
            profileId={profileId}
            engagementMap={engagementMap}
          />
          <AddPortfolioWorkButton profileId={profileId} />
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
            <AddWorkButton profileId={profileId} />
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
          <p className="text-sm text-muted-foreground">Works transferred to collectors. These are permanent provenance records.</p>
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

      {tab === "collected" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Works you own — received as gifts or purchased from other artists.</p>
          {collectedWorks.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border">
              <p className="text-sm text-muted-foreground">No collected works yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {collectedWorks.map((w) => (
                <div key={w.id} className="flex items-center gap-4 py-4">
                  {w.url && (
                    <img src={w.url} alt={w.caption ?? ""} className="w-12 h-12 object-cover shrink-0 bg-muted" />
                  )}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">{w.caption ?? "Untitled"}</p>
                    {w.price != null && (
                      <p className="text-xs text-muted-foreground">{w.price_currency ?? "NZD"} {w.price.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
