"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectUpdateWithArtist } from "@/types/database";

const TILE_H = 200;

export function StudioUpdateTile({ u }: { u: ProjectUpdateWithArtist }) {
  const href = u.project_id ? `/threads/${u.project_id}` : `/projects/${u.id}`;

  const isImage = u.content_type === "image" || (!u.content_type && !!u.image_url);

  const [cardWidth, setCardWidth] = useState<number | null>(() =>
    isImage && u.image_width && u.image_height
      ? Math.round(TILE_H * (u.image_width / u.image_height))
      : null
  );

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (cardWidth !== null) return;
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setCardWidth(Math.round(TILE_H * (img.naturalWidth / img.naturalHeight)));
    }
  }

  const cardStyle = isImage && cardWidth ? { width: cardWidth } : isImage ? undefined : { width: 200 };

  return (
    <Link
      href={href}
      className="flex-none block border border-border bg-background"
      style={cardStyle}
    >
      <div className="overflow-hidden bg-muted" style={{ height: TILE_H }}>
        {u.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.image_url}
            alt={u.caption ?? "Studio update"}
            style={{ height: TILE_H, width: "auto", display: "block" }}
            onLoad={handleImgLoad}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {u.content_type}
            </span>
          </div>
        )}
      </div>
      {u.caption && (
        <div className="px-2 py-1.5 border-t border-border min-w-0 overflow-hidden">
          <p className="text-[10px] text-muted-foreground line-clamp-2">{u.caption}</p>
        </div>
      )}
    </Link>
  );
}
