"use client";

import { useState } from "react";
import { PostOpportunityModal } from "./PostOpportunityModal";
import type { Opportunity } from "@/types/database";

const CARD_H = 225;
const CARD_W = 280;

const TYPE_LABELS: Record<string, string> = {
  Grant: "Grant",
  Commission: "Commission",
  Residency: "Residency",
  "Open Call": "Open Call",
  Prize: "Prize",
  Display: "Display",
};

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  initialOpportunities: Opportunity[];
  isOwner: boolean;
}

export function LiveOpportunitiesSection({ initialOpportunities, isOwner }: Props) {
  const [opps, setOpps] = useState<Opportunity[]>(initialOpportunities);

  if (!isOwner && opps.length === 0) return null;

  function handleOppAdded(opp: Opportunity) {
    setOpps((prev) => [opp, ...prev]);
  }

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Live Opportunities
      </h2>

      {opps.length === 0 && isOwner ? (
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">No active opportunities at this time.</p>
          <PostOpportunityModal onSuccess={handleOppAdded} />
        </div>
      ) : opps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active opportunities at this time.</p>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ height: CARD_H }}
        >
          {opps.map((opp) => (
            <div
              key={opp.id}
              className="flex-none flex flex-col border border-border bg-background snap-start overflow-hidden p-4 gap-2"
              style={{ height: CARD_H, width: CARD_W, boxSizing: "border-box" }}
            >
              {/* Type badge */}
              <span className="text-[10px] font-mono uppercase tracking-widest border border-black px-1.5 py-0.5 self-start leading-none">
                {TYPE_LABELS[opp.type] ?? opp.type}
              </span>

              {/* Title */}
              <p className="text-sm font-semibold leading-snug line-clamp-3 flex-1">
                {opp.title}
              </p>

              {/* Budget */}
              {opp.caption && (
                <p className="text-xs text-muted-foreground">{opp.caption}</p>
              )}

              {/* Description snippet */}
              {opp.description && (
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  {opp.description}
                </p>
              )}

              {/* Deadline */}
              {opp.deadline && (
                <p className="text-[10px] font-mono text-muted-foreground mt-auto">
                  Closes {formatDeadline(opp.deadline)}
                </p>
              )}
            </div>
          ))}

          {/* Add button at end of track (owner only) */}
          {isOwner && (
            <div
              className="flex-none flex items-center justify-center border border-dashed border-border snap-start"
              style={{ height: CARD_H, width: CARD_H }}
            >
              <PostOpportunityModal onSuccess={handleOppAdded} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
