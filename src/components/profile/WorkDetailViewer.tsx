"use client";

import { useState } from "react";
import type { WorkImage } from "@/types/database";

interface Props {
  primaryUrl: string;
  galleryImages: WorkImage[];
  caption: string;
}

export function WorkDetailViewer({ primaryUrl, galleryImages, caption }: Props) {
  const defaultUrl =
    galleryImages.find(i => i.is_primary)?.url ?? galleryImages[0]?.url ?? primaryUrl;

  const [activeUrl, setActiveUrl] = useState(defaultUrl);

  return (
    <div className="space-y-3">
      {/* Primary display */}
      <div className="bg-muted border border-border overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activeUrl}
          src={activeUrl}
          alt={caption}
          className="w-full h-auto block max-h-[75vh] object-contain"
        />
      </div>

      {/* Thumbnail strip — only when multiple images exist */}
      {galleryImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {galleryImages.map(img => (
            <button
              key={img.id}
              onClick={() => setActiveUrl(img.url)}
              className={`shrink-0 w-16 h-16 border overflow-hidden bg-muted transition-opacity ${
                activeUrl === img.url
                  ? "border-black"
                  : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
