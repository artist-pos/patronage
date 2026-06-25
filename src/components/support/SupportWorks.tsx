"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { WorksJustifiedGrid } from "@/components/feed/WorksJustifiedGrid";
import type { ArtworkForGrid } from "@/components/feed/WorksJustifiedGrid";
import { saveSupportWorksLimit } from "@/app/support/works-limit-actions";

interface Props {
  artworks: ArtworkForGrid[];
  initialLimit: number;
  isAdmin: boolean;
}

export function SupportWorks({ artworks, initialLimit, isAdmin }: Props) {
  const [limit, setLimit] = useState(initialLimit);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  const max = artworks.length;
  const shown = artworks.slice(0, limit);

  function handleSave() {
    setSaveState("saving");
    startTransition(async () => {
      const res = await saveSupportWorksLimit(limit);
      if (res?.error) {
        setSaveState("error");
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Admin: choose how many works show here, then save (desktop only) */}
      {isAdmin && max > 1 && (
        <div className="hidden items-center gap-4 border-b border-border pb-3 sm:flex">
          <label className="whitespace-nowrap text-xs text-muted-foreground">
            Works shown: {Math.min(limit, max)}
          </label>
          <input
            type="range"
            min={1}
            max={max}
            step={1}
            value={Math.min(limit, max)}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-40 accent-black"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="border border-black px-3 py-1.5 text-xs transition-colors hover:bg-muted/40 disabled:opacity-50"
          >
            {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Save"}
          </button>
          {saveState === "error" && (
            <span className="text-xs text-red-600">Error saving</span>
          )}
        </div>
      )}

      <WorksJustifiedGrid artworks={shown} />

      <div>
        <Link
          href="/works"
          className="text-sm text-stone-500 underline underline-offset-4 transition-colors hover:text-stone-900"
        >
          View all works
        </Link>
      </div>
    </div>
  );
}
