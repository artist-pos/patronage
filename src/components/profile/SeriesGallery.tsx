"use client";

import { useState } from "react";
import { SeriesLightbox } from "@/components/profile/SeriesLightbox";
import type { SeriesWork } from "@/types/database";

interface Props {
  artworks: SeriesWork[];
  artistId: string;
  artistName: string;
  artistUsername: string;
  viewer: { id: string } | null;
}

export function SeriesGallery({ artworks, artistId, artistName, artistUsername, viewer }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (artworks.length === 0) {
    return <p className="text-sm text-muted-foreground">No works in this series yet.</p>;
  }

  return (
    <>
      {/* Justified grid using flex-wrap — same pattern as portfolio */}
      <div className="flex flex-wrap gap-1.5">
        {artworks.map((artwork, i) => {
          const ar = (artwork as { natural_width?: number; natural_height?: number }).natural_width && (artwork as { natural_width?: number; natural_height?: number }).natural_height
            ? ((artwork as { natural_width?: number }).natural_width! / (artwork as { natural_height?: number }).natural_height!)
            : 1;
          const targetH = 300;
          const w = Math.round(ar * targetH);

          return (
            <button
              key={artwork.id}
              onClick={() => setLightboxIndex(i)}
              className="relative overflow-hidden bg-stone-100 shrink-0 group"
              style={{ width: w, height: targetH }}
            >
              {artwork.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artwork.url}
                  alt={artwork.title ?? artwork.caption ?? ""}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
              )}
              {artwork.is_available && (
                <div className="absolute bottom-2 left-2">
                  <span className="bg-white/90 text-[10px] font-medium px-1.5 py-0.5 text-stone-700">
                    Available
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <SeriesLightbox
          artworks={artworks}
          initialIndex={lightboxIndex}
          artistId={artistId}
          artistName={artistName}
          artistUsername={artistUsername}
          viewer={viewer}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
