"use client";

import { useState } from "react";
import { PortfolioDetailModal } from "./PortfolioDetailModal";
import type { PortfolioImage } from "@/types/database";

interface Props {
  images: PortfolioImage[];
  artistName?: string;
  viewerRole?: string | null;
}

function PortfolioItem({ img, onClick }: { img: PortfolioImage; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 cursor-pointer group shrink-0" onClick={onClick}>
      {/* Fixed 500px height, width follows the image's natural aspect ratio */}
      <div className="border border-border overflow-hidden h-[300px] w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Portfolio work"}
          className="h-full w-auto block group-hover:opacity-90 transition-opacity"
        />
      </div>
      {img.caption && (
        <p className="text-xs text-muted-foreground leading-snug font-mono">
          {img.caption}
        </p>
      )}
    </div>
  );
}

export function PortfolioGrid({ images, artistName, viewerRole }: Props) {
  const [selectedImg, setSelectedImg] = useState<PortfolioImage | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {images.map((img) => (
          <PortfolioItem
            key={img.id}
            img={img}
            onClick={() => setSelectedImg(img)}
          />
        ))}
      </div>

      {selectedImg && (
        <PortfolioDetailModal
          img={selectedImg}
          onClose={() => setSelectedImg(null)}
          artistName={artistName}
          viewerRole={viewerRole}
        />
      )}
    </>
  );
}
