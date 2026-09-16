"use client";

import { Fragment } from "react";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunitySignupModalTrigger } from "./OpportunitySignupModalTrigger";
import type { Opportunity, OpportunityWithMatch } from "@/types/database";

interface Props {
  opportunities: (Opportunity | OpportunityWithMatch)[];
  view?: "gallery" | "list";
  priorityOffset?: number;
  isAuthenticated?: boolean;
}

// Roughly the 5th row of a 3-column grid — deep enough to be a deliberate
// "you're clearly browsing" signal, not a knee-jerk reaction to the first
// couple of cards.
const SIGNUP_MODAL_TRIGGER_AFTER = 15;

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

  const showSignupModalTrigger = !isAuthenticated && opportunities.length > SIGNUP_MODAL_TRIGGER_AFTER;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {opportunities.map((opp, i) => (
        <Fragment key={opp.id}>
          <div>
            <OpportunityCard opp={opp} view="gallery" priority={i + priorityOffset < 3} isAuthenticated={isAuthenticated} />
          </div>
          {showSignupModalTrigger && i === SIGNUP_MODAL_TRIGGER_AFTER - 1 && <OpportunitySignupModalTrigger />}
        </Fragment>
      ))}
    </div>
  );
}
