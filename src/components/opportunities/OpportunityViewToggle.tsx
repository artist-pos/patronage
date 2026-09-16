"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" />
      <rect x="9" y="1" width="6" height="6" />
      <rect x="1" y="9" width="6" height="6" />
      <rect x="9" y="9" width="6" height="6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="4" x2="15" y2="4" />
      <line x1="1" y1="8" x2="15" y2="8" />
      <line x1="1" y1="12" x2="15" y2="12" />
    </svg>
  );
}

/** A display preference, not a filter — kept separate from OpportunityFilters
 *  and placed beside the results themselves rather than in the filter panel. */
export function OpportunityViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") ?? "gallery";

  const setView = useCallback(
    (view: "gallery" | "list") => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === "gallery") params.delete("view"); else params.set("view", view);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex shrink-0 items-center border border-border">
      <button
        onClick={() => setView("gallery")}
        aria-label="Gallery view"
        className={`p-2 transition-colors ${currentView === "gallery" ? "bg-foreground text-white" : "text-muted-foreground hover:bg-muted"}`}
      >
        <GridIcon />
      </button>
      <button
        onClick={() => setView("list")}
        aria-label="List view"
        className={`border-l border-border p-2 transition-colors ${currentView === "list" ? "bg-foreground text-white" : "text-muted-foreground hover:bg-muted"}`}
      >
        <ListIcon />
      </button>
    </div>
  );
}
