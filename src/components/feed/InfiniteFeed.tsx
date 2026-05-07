"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeedCard } from "@/components/feed/FeedCard";
import type { ProjectUpdateWithArtist } from "@/types/database";

const PAGE_SIZE = 10;

type FeedAudience = "everyone" | "following" | "subscribed";

interface Props {
  initialUpdates: ProjectUpdateWithArtist[];
  initialHasMore: boolean;
  audience?: FeedAudience;
  isLoggedIn?: boolean;
  rightSlot?: React.ReactNode;
}

export function InfiniteFeed({
  initialUpdates,
  initialHasMore,
  audience = "everyone",
  isLoggedIn = false,
  rightSlot,
}: Props) {
  const [updates, setUpdates] = useState<ProjectUpdateWithArtist[]>(initialUpdates);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
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
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "400px" }
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

  const isEmpty = updates.length === 0;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Audience filter */}
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          <button
            onClick={() => updateParam("audience", "everyone")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              audience === "everyone"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Everyone
          </button>
          {isLoggedIn && (
            <button
              onClick={() => updateParam("audience", "following")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                audience === "following"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Following
            </button>
          )}
          {isLoggedIn && (
            <button
              onClick={() => updateParam("audience", "subscribed")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                audience === "subscribed"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Subscribed
            </button>
          )}
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
        <>
          {/* Mobile: 2-column flex split — avoids iOS Safari CSS columns bug */}
          <div className="flex gap-2 items-start sm:hidden">
            {[0, 1].map((col) => (
              <div key={col} className="flex flex-col gap-2 flex-1 min-w-0">
                {updates.filter((_, i) => i % 2 === col).map((u, colIdx) => (
                  <FeedCard key={u.id} u={u} priority={col === 0 && colIdx === 0} />
                ))}
              </div>
            ))}
          </div>

          {/* sm+: CSS columns masonry */}
          <div className="hidden sm:block columns-3 lg:columns-4 xl:columns-5 gap-2">
            {updates.map((u, i) => (
              <FeedCard key={u.id} u={u} priority={i < 2} />
            ))}
          </div>
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
