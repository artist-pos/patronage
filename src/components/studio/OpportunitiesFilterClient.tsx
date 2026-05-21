"use client";

import { useState } from "react";
import Link from "next/link";
import type { SavedWithOpportunity } from "@/lib/saved-opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { ApplicationsTab } from "@/components/dashboard/ApplicationsTab";

type OppFilter = "all" | "saved" | "closing" | "applied" | "expired";

interface Props {
  initialFilter: OppFilter;
  userId: string;
  savedList: SavedWithOpportunity[];
  closingSoon: SavedWithOpportunity[];
  applied: SavedWithOpportunity[];
  expired: SavedWithOpportunity[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applications: any[];
  artistName?: string | null;
  artistGstRegistered?: boolean;
  artistGstNumber?: string | null;
}

export function OpportunitiesFilterClient({
  initialFilter, userId,
  savedList, closingSoon, applied, expired, applications,
  artistName, artistGstRegistered = false, artistGstNumber = null,
}: Props) {
  const [filter, setFilter] = useState<OppFilter>(initialFilter);

  function switchFilter(f: OppFilter) {
    setFilter(f);
    window.history.replaceState(null, "", `/studio?section=opportunities&of=${f}`);
  }

  const oppCounts = {
    all:     savedList.length + closingSoon.length + applied.length + expired.length,
    saved:   savedList.length,
    closing: closingSoon.length,
    applied: applied.length,
    expired: expired.length,
  };

  const list =
    filter === "saved"   ? savedList
    : filter === "closing" ? closingSoon
    : filter === "applied" ? applied
    : filter === "expired" ? expired
    : [...closingSoon, ...savedList, ...applied, ...expired];

  const OPP_FILTERS = ["all", "saved", "closing", "applied", "expired"] as const;

  return (
    <div className="space-y-6">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {OPP_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => switchFilter(f)}
            className={`text-xs px-3 py-1.5 border transition-colors capitalize ${
              filter === f
                ? "border-black bg-black text-white"
                : "border-border hover:border-black"
            }`}
          >
            {f === "all" ? "All" : f === "saved" ? "Saved" : f === "closing" ? "Closing Soon" : f === "applied" ? "Applied" : "Expired"}
            {" "}
            <span className="opacity-60 tabular-nums">({oppCounts[f]})</span>
          </button>
        ))}
      </div>

      {/* Applications panel */}
      {(filter === "applied" || (filter === "all" && applications.length > 0)) && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pipeline Applications</p>
          <ApplicationsTab
            initialApplications={applications}
            userId={userId}
            artistName={artistName}
            artistGstRegistered={artistGstRegistered}
            artistGstNumber={artistGstNumber}
          />
        </div>
      )}

      {/* Saved list */}
      {list.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {filter === "saved" && "No saved opportunities. Browse and save ones you're interested in."}
            {filter === "closing" && "No saved opportunities closing soon."}
            {filter === "applied" && "No saved opportunities marked as applied."}
            {filter === "expired" && "No expired saved opportunities."}
            {filter === "all" && "No saved opportunities yet."}
          </p>
          {(filter === "all" || filter === "saved") && (
            <Link href="/opportunities" className="inline-block mt-3 text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
              Browse opportunities →
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((saved) => (
            <OpportunityCard key={saved.id} opp={saved.opportunity} view="list" />
          ))}
        </div>
      )}
    </div>
  );
}
