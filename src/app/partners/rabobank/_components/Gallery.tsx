"use client";

import { useEffect, useId, useState } from "react";
import { AccessibleDialog } from "@/components/ui/AccessibleDialog";
import type { Work } from "@/lib/rabobank/shortlist";

function caption(w: Work): string {
  return [w.title, w.size, w.year, w.medium].filter(Boolean).join(" · ");
}

/**
 * "squares": cropped tiles in a grid (the staff shortlist). "natural": each work
 * uncropped at one shared row height, wrapping (for presenting).
 */
export function Gallery({ works, artistName, layout = "squares" }: { works: Work[]; artistName: string; layout?: "squares" | "natural" }) {
  const [index, setIndex] = useState<number | null>(null);
  const labelId = useId();
  const open = index !== null;

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? i : (i + 1) % works.length));
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? i : (i - 1 + works.length) % works.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, works.length]);

  if (!works.length) return <p className="text-sm text-muted-foreground">No works added yet.</p>;
  const w = index !== null ? works[index] : null;

  return (
    <>
      <ul className={layout === "natural" ? "flex flex-wrap content-start items-start gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-4"}>
        {works.map((work, i) => (
          <li key={work.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className={`block overflow-hidden rounded-[3px] bg-stone-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none ${layout === "natural" ? "" : "aspect-square w-full"}`}
              aria-label={`View ${work.title || "work"} by ${artistName} larger`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={work.thumb_url || work.image_url}
                alt={work.title || `Work by ${artistName}`}
                loading="lazy"
                className="block max-w-none object-cover"
                // Inline, because the site-wide img rule (height: auto) outranks utility classes.
                style={layout === "natural" ? { height: "clamp(9rem, 16vw, 15rem)", width: "auto" } : { height: "100%", width: "100%" }}
              />
            </button>
          </li>
        ))}
      </ul>

      <AccessibleDialog
        open={open}
        onClose={() => setIndex(null)}
        labelledBy={labelId}
        className="bg-background w-full max-w-4xl p-4 space-y-3 rounded-xl"
      >
        {w && (
          <>
            <div className="flex items-start justify-between gap-4">
              <p id={labelId} className="text-sm">
                <strong>{artistName}</strong>
                {caption(w) && <span className="text-muted-foreground"> — {caption(w)}</span>}
              </p>
              <button type="button" onClick={() => setIndex(null)} className="min-h-9 shrink-0 rounded-md border border-input px-3 text-sm">
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.image_url} alt={w.title || `Work by ${artistName}`} className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
            {works.length > 1 && (
              <div className="flex justify-between">
                <button type="button" className="min-h-9 rounded-md border border-input px-4 text-sm" onClick={() => setIndex((index! - 1 + works.length) % works.length)}>
                  Previous
                </button>
                <span className="self-center text-xs text-muted-foreground">{index! + 1} of {works.length}</span>
                <button type="button" className="min-h-9 rounded-md border border-input px-4 text-sm" onClick={() => setIndex((index! + 1) % works.length)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </AccessibleDialog>
    </>
  );
}
