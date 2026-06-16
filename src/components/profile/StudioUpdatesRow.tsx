"use client";

import { useState, useRef, useEffect } from "react";
import { StudioUpdateTile } from "@/components/profile/StudioUpdateTile";
import type { ProjectUpdateWithArtist } from "@/types/database";

const TILE_H = 200;
const GAP = 8;
const FALLBACK_W = 200; // non-image tiles render at a fixed 200px square

/** Estimate a tile's rendered width (height is fixed at TILE_H) so we can pack a row. */
function tileWidth(u: ProjectUpdateWithArtist): number {
  const isImage = u.content_type === "image" || (!u.content_type && !!u.image_url);
  if (isImage && u.image_width && u.image_height) {
    return Math.min(360, Math.max(150, Math.round(TILE_H * (u.image_width / u.image_height))));
  }
  return FALLBACK_W;
}

export function StudioUpdatesRow({
  updates,
  username,
}: {
  updates: ProjectUpdateWithArtist[];
  username: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setContainerW(el.offsetWidth);
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // How many tiles fit in a single row at the current width.
  let fitCount: number;
  if (containerW == null) {
    fitCount = Math.min(updates.length, 6); // pre-measure default; extras are clipped
  } else {
    let used = 0;
    fitCount = 0;
    for (const u of updates) {
      const next = used + (fitCount > 0 ? GAP : 0) + tileWidth(u);
      if (next > containerW && fitCount > 0) break;
      used = next;
      fitCount++;
    }
    fitCount = Math.max(1, fitCount);
  }

  const hasMore = updates.length > fitCount;
  const visible = expanded ? updates : updates.slice(0, fitCount);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Studio Updates
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">Recent updates</p>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
          >
            {expanded ? "Show less" : `View all ${updates.length}`}
          </button>
        )}
      </div>

      <div
        ref={ref}
        className={
          expanded
            ? "flex flex-wrap gap-2 items-start"
            : "flex gap-2 items-start overflow-hidden"
        }
      >
        {visible.map((u) => (
          <StudioUpdateTile key={u.id} u={u} />
        ))}
      </div>

      {expanded && (
        <a
          href={`/${username}?tab=studio`}
          className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Open studio feed →
        </a>
      )}
    </div>
  );
}
