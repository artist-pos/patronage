"use client";

import { useState } from "react";
import { PortfolioDetailModal } from "./PortfolioDetailModal";
import type { PortfolioImage } from "@/types/database";

interface Props {
  images: PortfolioImage[];
  artistName?: string;
  viewerRole?: string | null;
  limit?: number;
}

function PortfolioItem({ img, onClick }: { img: PortfolioImage; onClick: () => void }) {
  const [isLandscape, setIsLandscape] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    setIsLandscape(el.naturalWidth / el.naturalHeight > 1.2);
    setLoaded(true);
  }

  return (
    <div
      className={`flex flex-col gap-1.5 cursor-pointer group ${isLandscape ? "col-span-2" : ""} md:shrink-0 md:w-fit`}
      onClick={onClick}
    >
      <div
        className={`border border-border overflow-hidden md:h-[300px] md:w-fit${!loaded ? " max-md:aspect-square" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Portfolio work"}
          loading="lazy"
          className="w-full h-auto max-md:object-cover md:h-full md:w-auto group-hover:opacity-90 transition-opacity block"
          onLoad={handleLoad}
        />
      </div>
      {img.caption && (
        <p className="text-xs text-muted-foreground leading-snug font-mono max-w-0 min-w-full break-words">
          {img.caption}
        </p>
      )}
    </div>
  );
}

export function PortfolioGrid({ images, artistName, viewerRole, limit }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const displayed = limit ? images.slice(0, limit) : images;
  const selectedImg = selectedIndex !== null ? displayed[selectedIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-4">
        {displayed.map((img, i) => (
          <PortfolioItem
            key={img.id}
            img={img}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      {selectedImg && (
        <PortfolioDetailModal
          img={selectedImg}
          onClose={() => setSelectedIndex(null)}
          onPrev={() => setSelectedIndex(i => Math.max(0, i! - 1))}
          onNext={() => setSelectedIndex(i => Math.min(displayed.length - 1, i! + 1))}
          hasPrev={selectedIndex! > 0}
          hasNext={selectedIndex! < displayed.length - 1}
          artistName={artistName}
          viewerRole={viewerRole}
        />
      )}
    </>
  );
}
