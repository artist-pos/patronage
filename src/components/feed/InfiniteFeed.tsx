"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FeedCard } from "@/components/feed/FeedCard";
import type { ProjectUpdateWithArtist } from "@/types/database";

const PAGE_SIZE = 10;

interface Props {
  initialUpdates: ProjectUpdateWithArtist[];
  initialHasMore: boolean;
}

export function InfiniteFeed({ initialUpdates, initialHasMore }: Props) {
  const [updates, setUpdates] = useState<ProjectUpdateWithArtist[]>(initialUpdates);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(initialUpdates.length);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?offset=${offsetRef.current}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const { updates: next, hasMore: more } = await res.json();
      setUpdates((prev) => [...prev, ...next]);
      setHasMore(more);
      offsetRef.current += next.length;
    } catch {
      // silently fail — user can scroll up and back down to retry
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore]);

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

  if (updates.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing here yet. Studio updates are for works in progress, process shots, thoughts — whatever you&apos;re working on right now.</p>;
  }

  return (
    <>
      {/* Mobile: 2-column flex split — avoids iOS Safari CSS columns bug */}
      <div className="flex gap-2 items-start sm:hidden">
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-2 flex-1 min-w-0">
            {updates.filter((_, i) => i % 2 === col).map((u, colIdx) => (
              <FeedCard
                key={u.id}
                u={u}
                priority={col === 0 && colIdx === 0}
              />
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

      {/* Sentinel — triggers next load when scrolled into view */}
      <div ref={sentinelRef} className="h-px" />

      {loading && (
        <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
      )}
      {!hasMore && updates.length > PAGE_SIZE && (
        <p className="text-xs text-muted-foreground text-center py-4">All updates loaded.</p>
      )}
    </>
  );
}
