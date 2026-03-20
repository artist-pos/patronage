"use client";

import { useState } from "react";
import { OpportunityCard } from "./OpportunityCard";
import { MasonryGrid } from "./MasonryGrid";
import type { Opportunity } from "@/types/database";

interface Props {
  matched: Opportunity[];
  lessRelevant: Opportunity[];
  view: "gallery" | "list";
  isAuthenticated?: boolean;
}

export function RelevantFeed({ matched, lessRelevant, view, isAuthenticated = false }: Props) {
  const [showAll, setShowAll] = useState(false);

  const renderList = (opps: Opportunity[], offset = 0) => (
    <div className="border-t border-black">
      {opps.map((opp, i) => (
        <OpportunityCard key={opp.id} opp={opp} view="list" priority={i + offset < 6} />
      ))}
    </div>
  );

  const renderGallery = (opps: Opportunity[], priority = false) => (
    <MasonryGrid opportunities={opps} priorityOffset={priority ? 0 : matched.length} isAuthenticated={isAuthenticated} />
  );

  const all = [...matched, ...lessRelevant];

  // No relevance splitting (no user or filters active) — just show everything
  if (lessRelevant.length === 0) {
    return view === "list" ? renderList(all) : renderGallery(all, true);
  }

  return (
    <div className="space-y-0">
      {/* Matched opportunities */}
      {matched.length > 0 && (
        view === "list" ? renderList(matched) : renderGallery(matched, true)
      )}

      {matched.length === 0 && (
        <p className="text-sm text-muted-foreground py-6">
          No opportunities matched your disciplines or country. Showing all below.
        </p>
      )}

      {/* Less relevant section */}
      <div className="mt-8">
        <button
          onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group mb-6"
        >
          <span className={`transition-transform ${showAll ? "rotate-90" : ""}`}>›</span>
          {showAll
            ? "Hide less relevant opportunities"
            : `Show ${lessRelevant.length} less relevant opportunit${lessRelevant.length === 1 ? "y" : "ies"}`}
        </button>

        {showAll && (
          <div className="border-t border-dashed border-border pt-6">
            {view === "list"
              ? renderList(lessRelevant, matched.length)
              : renderGallery(lessRelevant)}
          </div>
        )}
      </div>
    </div>
  );
}
