"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AccessibleDialog } from "@/components/ui/AccessibleDialog";
import type { Work } from "@/lib/rabobank/shortlist";

function caption(w: Work): string {
  return [w.title, w.size, w.year, w.medium].filter(Boolean).join(" · ");
}

const LIST: Record<Layout, string> = {
  squares: "grid grid-cols-2 gap-2 sm:grid-cols-4",
  natural: "flex flex-wrap content-start items-start gap-2",
  thumbs: "grid grid-cols-4 gap-1.5",
};
type Layout = "squares" | "natural" | "thumbs";

/**
 * "squares": cropped tiles in a grid (the staff shortlist). "natural": each work
 * uncropped at one shared row height, wrapping (for presenting). "thumbs": small
 * cropped tiles (profile cards). Any work opens full screen, with the artist's
 * photo and name along the bottom.
 */
export function Gallery({
  works,
  artistName,
  artistPhoto = null,
  layout = "squares",
}: {
  works: Work[];
  artistName: string;
  artistPhoto?: string | null;
  layout?: Layout;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const labelId = useId();
  const touchX = useRef<number | null>(null);
  const open = index !== null;
  const step = (d: number) => setIndex((i) => (i === null ? i : (i + d + works.length) % works.length));

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
  const many = works.length > 1;

  return (
    <>
      <ul className={LIST[layout]}>
        {works.map((work, i) => (
          <li key={work.id} className="max-w-full">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className={`block cursor-zoom-in overflow-hidden rounded-[3px] bg-stone-100 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${layout === "natural" ? "" : "aspect-square w-full"}`}
              aria-label={`View ${work.title || "work"} by ${artistName} full screen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={work.thumb_url || work.image_url}
                alt={work.title || `Work by ${artistName}`}
                loading="lazy"
                className="block max-w-none object-cover"
                // Inline, because the site-wide img rule (height: auto) outranks utility classes.
                style={layout === "natural" ? { height: "clamp(9rem, 16vw, 15rem)", width: "auto", maxWidth: "100%" } : { height: "100%", width: "100%" }}
              />
            </button>
          </li>
        ))}
      </ul>

      <AccessibleDialog
        open={open}
        onClose={() => setIndex(null)}
        labelledBy={labelId}
        backdropClassName="fixed inset-0 z-[60] flex bg-[#0c0a09]"
        className="relative flex h-dvh w-full flex-col text-white"
        closeOnBackdrop={false}
      >
        {w && (
          <>
            <button
              type="button"
              onClick={() => setIndex(null)}
              className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>

            {/* The work, as large as the screen allows. Tap the dark area to close; swipe to move. */}
            <div
              className="flex min-h-0 flex-1 items-center justify-center px-4 pb-2 pt-16 sm:px-20"
              onClick={(e) => { if (e.target === e.currentTarget) setIndex(null); }}
              onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (touchX.current === null || !many) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
                touchX.current = null;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={w.id}
                src={w.image_url}
                alt={w.title || `Work by ${artistName}`}
                className="select-none object-contain shadow-2xl"
                style={{ maxHeight: "100%", maxWidth: "100%", height: "auto", width: "auto" }}
              />
            </div>

            {many && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:left-5"
                  aria-label="Previous work"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:right-5"
                  aria-label="Next work"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            {/* Who made it, along the bottom. */}
            <div className="flex items-center gap-3 px-5 pb-5 pt-3 sm:px-8">
              {artistPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artistPhoto} alt="" className="size-11 shrink-0 rounded-full object-cover ring-1 ring-white/20" style={{ height: "2.75rem", width: "2.75rem" }} />
              )}
              <div className="min-w-0 flex-1">
                <p id={labelId} className="truncate font-medium">{artistName}</p>
                {caption(w) && <p className="truncate text-sm text-white/60">{caption(w)}</p>}
              </div>
              {many && <p className="shrink-0 text-sm tabular-nums text-white/60">{index! + 1} / {works.length}</p>}
            </div>
          </>
        )}
      </AccessibleDialog>
    </>
  );
}
