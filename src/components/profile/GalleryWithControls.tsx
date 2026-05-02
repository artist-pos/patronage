"use client";

import { useState } from "react";
import { PortfolioGrid } from "@/components/profile/PortfolioGrid";
import type { PortfolioImage } from "@/types/database";

interface Props {
  images: PortfolioImage[];
  username: string;
  viewerRole?: string | null;
  profileId?: string;
  limit?: number;
  isOwner?: boolean;
}

const DEFAULT_ROW_H  = 280;
const DEFAULT_GUTTER = 6;

export function GalleryWithControls({ images, username, viewerRole, profileId, limit, isOwner }: Props) {
  const [rowH, setRowH]     = useState(DEFAULT_ROW_H);
  const [gutter, setGutter] = useState(DEFAULT_GUTTER);

  return (
    <>
      {isOwner && (
        <div className="flex flex-wrap items-center gap-6 mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Row height: {rowH}px
            </label>
            <input
              type="range"
              min={120}
              max={500}
              step={10}
              value={rowH}
              onChange={(e) => setRowH(Number(e.target.value))}
              className="w-28 accent-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Spacing: {gutter}px
            </label>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={gutter}
              onChange={(e) => setGutter(Number(e.target.value))}
              className="w-24 accent-black"
            />
          </div>
          <button
            type="button"
            onClick={() => console.log("Gallery layout:", { rowHeight: rowH, gutter })}
            className="text-xs px-3 py-1.5 border border-black hover:bg-muted/40 transition-colors"
          >
            Save layout
          </button>
        </div>
      )}

      <PortfolioGrid
        images={images}
        username={username}
        viewerRole={viewerRole}
        profileId={profileId}
        limit={limit}
        isOwner={isOwner}
        rowH={rowH}
        gutter={gutter}
      />
    </>
  );
}
