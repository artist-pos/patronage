"use client";

import { useState } from "react";
import type { SavedWithOpportunity } from "@/lib/saved-opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { ApplicationsTab } from "@/components/dashboard/ApplicationsTab";
import { EmptyState } from "@/components/ui/EmptyState";

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
    window.history.replaceState(null, "", `/studio/opportunities?of=${f}`);
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
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Open Call Applications</p>
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
        <EmptyState
          title={
            filter === "saved" ? "No saved opportunities"
            : filter === "closing" ? "Nothing closing soon"
            : filter === "applied" ? "No applications tracked"
            : filter === "expired" ? "No expired opportunities"
            : "Your opportunity tracker"
          }
          description={
            filter === "saved" ? "Browse grants, residencies, and open calls — then save the ones you want to come back to."
            : filter === "closing" ? "Opportunities with upcoming deadlines will appear here once you save some."
            : filter === "applied" ? "Mark saved opportunities as applied to keep track of your submissions."
            : filter === "expired" ? "Past-deadline opportunities you saved will appear here for reference."
            : "Save opportunities you're interested in and track your applications — all in one place."
          }
          actionLabel={(filter === "all" || filter === "saved") ? "Browse opportunities" : undefined}
          actionHref={(filter === "all" || filter === "saved") ? "/opportunities" : undefined}
        />
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
