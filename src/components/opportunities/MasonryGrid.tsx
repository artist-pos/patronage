"use client";

import { OpportunityCard } from "./OpportunityCard";
import type { Opportunity } from "@/types/database";

interface Props {
  opportunities: Opportunity[];
  view?: "gallery" | "list";
  priorityOffset?: number;
  isAuthenticated?: boolean;
}

export function MasonryGrid({ opportunities, view = "gallery", priorityOffset = 0, isAuthenticated = false }: Props) {
  if (view === "list") {
    return (
      <div className="border-t border-black">
        {opportunities.map((opp, i) => (
          <OpportunityCard key={opp.id} opp={opp} view="list" priority={i < 6} isAuthenticated={isAuthenticated} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {opportunities.map((opp, i) => (
        <div key={opp.id}>
          <OpportunityCard opp={opp} view="gallery" priority={i + priorityOffset < 3} isAuthenticated={isAuthenticated} />
        </div>
      ))}
    </div>
  );
}
