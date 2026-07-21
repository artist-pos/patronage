"use client";

import { useEffect, useState } from "react";
import { FeedCard } from "@/components/feed/FeedCard";
import type { ProjectUpdateWithArtist } from "@/types/database";

function useColumnCount(): number {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    function update() {
      if (window.innerWidth >= 1024) setCols(4);
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
  updates: ProjectUpdateWithArtist[];
  currentUserId?: string;
  isAdmin?: boolean;
}

/**
 * "All Updates" masonry — same FeedCard pin vocabulary as the Explore feed.
 * Column split is JS-measured round-robin (matching InfiniteFeed), not CSS
 * `columns`: CSS columns fill top-to-bottom per column (breaking reading
 * order) and are known to misbehave with flex containers on iOS Safari —
 * see CLAUDE.md "Feed masonry layout" fragile area.
 */
export function StudioAllUpdatesGrid({ updates, currentUserId, isAdmin = false }: Props) {
  const colCount = useColumnCount();

  return (
    <div className="flex items-start gap-2">
      {Array.from({ length: colCount }, (_, col) => (
        <div key={col} className="flex min-w-0 flex-1 flex-col gap-2">
          {updates
            .filter((_, i) => i % colCount === col)
            .map((u) => (
              <FeedCard key={u.id} u={u} currentUserId={currentUserId} isAdmin={isAdmin} />
            ))}
        </div>
      ))}
    </div>
  );
}
