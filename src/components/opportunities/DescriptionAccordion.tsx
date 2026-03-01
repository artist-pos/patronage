"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { track } from "@vercel/analytics";
import { trackEvent } from "@/actions/trackEvent";

interface Props {
  fullDescription: string | null;
  opportunityId?: string;
  title?: string;
  organiser?: string;
}

export function DescriptionAccordion({ fullDescription, opportunityId, title, organiser }: Props) {
  const [open, setOpen] = useState(false);

  if (!fullDescription?.trim()) return null;

  function handleOpen() {
    setOpen(true);
    if (opportunityId) {
      track("read_more", { title: title ?? "", organiser: organiser ?? "" });
      trackEvent("opportunity_engagement", {
        opportunity_id: opportunityId,
        title: title ?? "",
        organiser: organiser ?? "",
      });
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Read more — only shown when collapsed */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Read more</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      )}

      {/* Smooth CSS grid accordion — no CLS (user-interaction triggered) */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 300ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-0.5 pb-1">
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {fullDescription}
            </p>
            {/* Read less — at the bottom of the expanded box */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Read less</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
