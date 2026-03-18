"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ProjectUpdateWithArtist } from "@/types/database";

const FEED_H = 200;

export function StudioFeedCard({ u, className = "" }: { u: ProjectUpdateWithArtist; className?: string }) {
  const name = u.artist_full_name ?? u.artist_username;
  const href = u.project_id ? `/threads/${u.project_id}` : `/projects/${u.id}?from=feed`;

  const [cardWidth, setCardWidth] = useState<number | null>(() =>
    u.image_url && u.image_width && u.image_height
      ? Math.round(FEED_H * (u.image_width / u.image_height))
      : null
  );

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (cardWidth !== null) return;
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setCardWidth(Math.round(FEED_H * (img.naturalWidth / img.naturalHeight)));
    }
  }

  return (
    <Link
      href={href}
      scroll={false}
      className={`group block sm:inline-block border border-border bg-background overflow-hidden ${className}`}
      style={u.image_url && cardWidth ? { width: cardWidth } : u.image_url ? undefined : { width: 200 }}
    >
      {u.image_url && (
        <div className="w-fit bg-muted" style={{ height: FEED_H }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u.image_url}
            alt={u.caption ?? `Update by ${name}`}
            loading="lazy"
            style={{ height: FEED_H, width: "auto", display: "block" }}
            onLoad={handleImgLoad}
          />
        </div>
      )}
      <div className="px-2.5 py-1.5 border-t border-border">
        <div className="flex items-center gap-1.5 min-w-0">
          {u.artist_avatar_url ? (
            <div className="relative w-5 h-5 shrink-0 overflow-hidden border border-black">
              <Image src={u.artist_avatar_url} alt={name} fill loading="lazy" className="object-cover" sizes="20px" />
            </div>
          ) : (
            <div className="w-5 h-5 shrink-0 border border-black bg-muted flex items-center justify-center text-[8px] font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="text-xs font-semibold truncate flex-1 min-w-0">{name}</p>
        </div>
        {u.caption && (
          <p className="text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal">{u.caption}</p>
        )}
      </div>
    </Link>
  );
}
