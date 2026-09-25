"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeedCard } from "@/components/feed/FeedCard";
import { renderExplorePin, type ExplorePin } from "@/components/feed/ExplorePinCards";
import type { ProjectUpdateWithArtist } from "@/types/database";

/* Only used to decide whether "All updates loaded." is worth showing — the
   server owns the real page size. */
const PAGE_SIZE = 10;

/* Eager-load the first row of the *widest* layout (xl = 5 columns). This is
   decided during SSR, where the column count isn't known yet — so it has to
   cover the widest case or the right-hand columns get nothing. At `i < 4` the
   fifth column's top tile was always lazy, which is why the right of the feed
   visibly filled in last on desktop. Narrower layouts eager a little more than
   one row, which is a few thumbnails — cheap next to a blank column. */
const EAGER_COUNT = 5;

type FeedAudience = "everyone" | "following" | "subscribed";

function colsForWidth(width: number): number {
  if (width >= 1280) return 5;
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

/* Reads the real viewport in the state initializer (client-only, so this
   never runs during SSR) instead of defaulting to 2 and correcting via
   useEffect. The old default-then-correct approach hydrated matching the
   server's 2-column markup, then re-rendered a beat later once the effect
   measured the real width — every item whose column changed between the
   2-col and final layout got unmounted and remounted, cancelling any
   in-flight eager image fetch and restarting it. That's specifically why
   the rightmost column(s) on wide screens always looked slowest to fill
   in. Reading the width up front instead means the client's very first
   render already targets the final column count, so hydration mismatches
   once (server shipped 2 columns, since `window` doesn't exist there) and
   React rebuilds straight into the correct shape — every card mounts once,
   in its final column, with no cancelled fetch. */
function useColumnCount(): number {
  const [cols, setCols] = useState(() =>
    typeof window !== "undefined" ? colsForWidth(window.innerWidth) : 2
  );
  useEffect(() => {
    function update() {
      setCols(colsForWidth(window.innerWidth));
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

interface Props {
  initialUpdates: ProjectUpdateWithArtist[];
  initialHasMore: boolean;
  /** v2 Explore — available-work pins interleaved with updates */
  extraPins?: ExplorePin[];
  /** Full-width band (e.g. closing-soon opportunities) inserted after `bandAfter` items */
  band?: React.ReactNode;
  /** How many masonry items render before the band. Default 8. */
  bandAfter?: number;
  audience?: FeedAudience;
  isLoggedIn?: boolean;
  rightSlot?: React.ReactNode;
  /** signed-in user id — enables inline edit pencil on their own posts */
  currentUserId?: string;
  /** admins/owners can edit any post */
  isAdmin?: boolean;
  /** Page the audience filter navigates on. Default "/feed". */
  basePath?: string;
  /** "v2": sentence-case sans filter tabs ("All · Following · Supporting"),
   *  matching the underline tabs on the v2 browse pages. */
  variant?: "default" | "v2";
}

export function InfiniteFeed({
  initialUpdates,
  initialHasMore,
  extraPins = [],
  band,
  bandAfter = 8,
  audience = "everyone",
  isLoggedIn = false,
  rightSlot,
  currentUserId,
  isAdmin = false,
  basePath = "/feed",
  variant = "default",
}: Props) {
  const [updates, setUpdates] = useState<ProjectUpdateWithArtist[]>(initialUpdates);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const colCount = useColumnCount();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(initialUpdates.length);
  const router = useRouter();
  const params = useSearchParams();

  // Reset when initial updates change (audience switch causes page re-render)
  useEffect(() => {
    setUpdates(initialUpdates);
    setHasMore(initialHasMore);
    offsetRef.current = initialUpdates.length;
  }, [initialUpdates, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/feed?offset=${offsetRef.current}&audience=${audience}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const { updates: next, hasMore: more } = await res.json();
      setUpdates((prev) => [...prev, ...next]);
      setHasMore(more);
      offsetRef.current += next.length;
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, audience]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    // /api/feed costs ~300ms warm and ~1s cold. At 400px of lead time the
    // request only started once the last row was already on screen, so the
    // bottom of the feed sat empty for the whole round-trip. ~1.5 viewports of
    // margin starts the fetch while there's still content to scroll through.
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "1200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "feed");
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${basePath}?${next.toString()}`, { scroll: false });
  }

  const isEmpty = updates.length === 0 && extraPins.length === 0;

  // Interleave: every fourth update is followed by a work pin so art for sale
  // threads through the masonry without dominating it. Leftover pins only
  // render when there are no updates at all — never dumped below the feed.
  const items: React.ReactNode[] = [];
  {
    const extras = [...extraPins];
    // Eagerness follows position in the masonry, not position in `updates`.
    // Every fourth slot is a work pin, so counting updates put the fifth
    // column's top tile past the cutoff and left it lazy on every load.
    const eager = () => items.length < EAGER_COUNT;
    updates.forEach((u, i) => {
      items.push(
        <FeedCard
          key={u.id}
          u={u}
          priority={eager()}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      );
      if ((i + 1) % 4 === 0 && extras.length > 0) {
        const priority = eager();
        items.push(
          <div key={`x-${extras.length}`} className="mb-2">
            {renderExplorePin(extras.shift()!, priority)}
          </div>
        );
      }
    });
    if (updates.length === 0) {
      extras.forEach((p, i) => items.push(<div key={`r-${i}`} className="mb-2">{renderExplorePin(p)}</div>));
    }
  }

  // Split around the full-width band (if provided)
  const seg1 = band ? items.slice(0, bandAfter) : items;
  const seg2 = band ? items.slice(bandAfter) : [];

  const renderColumns = (segment: React.ReactNode[]) => (
    <div className="flex gap-2 items-start">
      {Array.from({ length: colCount }, (_, col) => (
        <div key={col} className="flex flex-col gap-2 flex-1 min-w-0">
          {segment.filter((_, i) => i % colCount === col)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Audience filter — logged-in only (a lone "all" button is noise) */}
        <div className={`flex items-stretch ${isLoggedIn ? "" : "hidden"}`}>
          {(variant === "v2"
            ? ([
                ["everyone", "All"],
                ...(isLoggedIn ? ([["following", "Following"], ["subscribed", "Supporting"]] as const) : []),
              ] as [FeedAudience, string][])
            : ([
                ["everyone", "all"],
                ...(isLoggedIn ? ([["following", "following"], ["subscribed", "subscribed"]] as const) : []),
              ] as [FeedAudience, string][])
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => updateParam("audience", value)}
              className={
                variant === "v2"
                  ? `mr-5 h-9 border-b-2 text-[14px] font-medium transition-colors ${
                      audience === value
                        ? "border-foreground text-foreground"
                        : "border-transparent text-[color:var(--fg-muted)] hover:text-foreground"
                    }`
                  : `h-9 border-b-2 px-3.5 font-mono text-xs lowercase transition-colors ${
                      audience === value
                        ? "border-brand text-brand"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right slot (e.g. New update button) */}
        {rightSlot && (
          <div className="flex items-center">
            {rightSlot}
          </div>
        )}
      </div>

      {isEmpty && (
        <p className="text-sm text-muted-foreground">
          {audience === "subscribed"
            ? "No updates from artists you support yet. Support an artist to see their studio updates here."
            : audience === "following"
              ? "No updates from artists you follow yet. Follow an artist to see their studio updates here."
              : "Nothing here yet. Studio updates are for works in progress, process shots, thoughts, whatever you're working on right now."}
        </p>
      )}

      {!isEmpty && (
        /* Round-robin column distribution — items fill left-to-right then down,
           matching reading order. CSS `columns` fills top-to-bottom per column
           which reverses this, so we manually assign items to columns instead.
           A full-width band (opportunities) splits the masonry in two. */
        <>
          {renderColumns(seg1)}
          {band}
          {seg2.length > 0 && renderColumns(seg2)}
        </>
      )}

      {/* Sentinel — triggers next load when scrolled into view */}
      <div ref={sentinelRef} className="h-px" />

      {loading && (
        <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
      )}
      {!hasMore && updates.length > PAGE_SIZE && (
        <p className="text-xs text-muted-foreground text-center py-4">All updates loaded.</p>
      )}
    </div>
  );
}
