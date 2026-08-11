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

function useColumnCount(): number {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    function update() {
      if (window.innerWidth >= 1280) setCols(5);
      else if (window.innerWidth >= 1024) setCols(4);
      else if (window.innerWidth >= 640) setCols(3);
      else setCols(2);
    }
    update();
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
    router.push(`/feed?${next.toString()}`, { scroll: false });
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
          {([
            ["everyone", "all"],
            ...(isLoggedIn
              ? ([["following", "following"], ["subscribed", "subscribed"]] as const)
              : []),
          ] as [FeedAudience, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => updateParam("audience", value)}
              className={`h-9 border-b-2 px-3.5 font-mono text-xs lowercase transition-colors ${
                audience === value
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
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
              : "Nothing here yet. Studio updates are for works in progress, process shots, thoughts — whatever you're working on right now."}
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
