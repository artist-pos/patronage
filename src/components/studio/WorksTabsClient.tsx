"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WorksManager,
  type WorkItem,
  type SeriesRow,
  type WorksFilter,
} from "@/components/dashboard/WorksTable";

interface Props {
  initialView: "list" | "grid";
  initialFilter: WorksFilter;
  profileComplete: boolean;
  missingFields: { key: string; label: string; href: string }[];
  works: WorkItem[];
  featuredCount: number;
  engagementMap: Record<string, { view: number; play: number }>;
  pendingConfirmationCount: number;
  seriesList: Array<{ id: string; title: string; slug: string; hero_image_url: string | null; artworkCount: number; is_featured: boolean; position: number }>;
  stripeConnectEnabled: boolean;
}

const FILTERS: { key: WorksFilter; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "for-sale", label: "For sale" },
  { key: "sold",     label: "Sold" },
  { key: "featured", label: "Featured" },
  { key: "archival", label: "Archival" },
];

export function WorksTabsClient({
  initialView, initialFilter, profileComplete, missingFields,
  works, engagementMap, pendingConfirmationCount, seriesList, stripeConnectEnabled,
}: Props) {
  const [filter, setFilter] = useState<WorksFilter>(initialFilter);
  const [view, setView] = useState<"list" | "grid">(initialView);

  const seriesItems: SeriesRow[] = seriesList.map(s => ({
    _kind: "series" as const,
    id: s.id,
    title: s.title,
    hero_image_url: s.hero_image_url,
    artworkCount: s.artworkCount,
    is_featured: s.is_featured,
    position: s.position,
  }));

  function syncUrl(next: { filter?: WorksFilter; view?: "list" | "grid" }) {
    const f = next.filter ?? filter;
    const v = next.view ?? view;
    window.history.replaceState(null, "", `/studio?section=works&wf=${f}&view=${v}`);
  }
  function changeFilter(f: WorksFilter) { setFilter(f); syncUrl({ filter: f }); }
  function changeView(v: "list" | "grid") { setView(v); syncUrl({ view: v }); }

  const counts: Record<WorksFilter, number> = {
    all:        works.length + seriesItems.length,
    "for-sale": works.filter(w => w.status === "for-sale").length,
    sold:       works.filter(w => w.status === "sold").length,
    featured:   works.filter(w => w.is_featured).length + seriesItems.filter(s => s.is_featured).length,
    archival:   works.filter(w => w.status === "archival").length + seriesItems.length,
  };
  const hasForSale = counts["for-sale"] > 0;

  return (
    <div className="space-y-6">
      {!stripeConnectEnabled && (
        <div className="flex items-center justify-between border border-stone-200 bg-stone-50 px-4 py-3 rounded-lg">
          <p className="text-sm text-stone-700">
            Connect a Stripe account to list works for sale. Any previously listed works have been delisted until you connect.
          </p>
          <Link href="/studio/earnings" className="text-sm text-stone-900 font-medium underline underline-offset-2 shrink-0 ml-4 whitespace-nowrap">
            Connect Stripe →
          </Link>
        </div>
      )}

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

      {hasForSale && !profileComplete && missingFields.length > 0 && (
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

      {/* Toolbar: filter pills + view toggle + add actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => changeFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === key
                  ? "bg-black text-white border-black"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {label} <span className={filter === key ? "opacity-70" : "opacity-50"}>{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          <button
            onClick={() => changeView("list")}
            title="List view"
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="4" x2="14" y2="4" /><line x1="2" y1="8" x2="14" y2="8" /><line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </button>
          <button
            onClick={() => changeView("grid")}
            title="Grid view"
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      <WorksManager
        works={works}
        seriesItems={seriesItems}
        featuredCount={counts.featured}
        engagementMap={engagementMap}
        filter={filter}
        view={view}
      />

      <div className="pt-4 border-t border-border flex flex-wrap items-center gap-3">
        <Link href="/studio/works/new?mode=list" className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity">
          + Add Available Work
        </Link>
        <Link href="/studio/works/new" className="text-sm border border-border px-4 py-2 hover:bg-muted/40 transition-colors">
          + Add work
        </Link>
        <Link href="/studio/works/new?mode=sale" className="text-sm border border-border px-4 py-2 hover:bg-muted/40 transition-colors">
          + Log a sale
        </Link>
        <Link href="/studio/series/new" className="text-sm border border-border px-4 py-2 hover:bg-muted/40 transition-colors">
          + New series
        </Link>
      </div>
    </div>
  );
}
