"use client";

import { useState } from "react";
import type { WorkImage } from "@/types/database";

interface Props {
  primaryUrl: string;
  galleryImages: WorkImage[];
  caption: string;
}

export function WorkDetailViewer({ primaryUrl, galleryImages, caption }: Props) {
  const defaultImg =
    galleryImages.find(i => i.is_primary) ?? galleryImages[0] ?? null;
  const defaultUrl = defaultImg?.url ?? primaryUrl;

  const [activeUrl, setActiveUrl] = useState(defaultUrl);

  const activeImg = galleryImages.find(i => i.url === activeUrl) ?? null;
  // Show per-image caption if set; fall back to the work's main caption
  const activeCaption = activeImg?.caption?.trim() || caption;

  return (
    <div className="space-y-3">
      {/* Primary display */}
      <div className="bg-muted border border-border overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activeUrl}
          src={activeUrl}
          alt={activeCaption ?? ""}
          className="w-full h-auto block max-h-[75vh] object-contain"
        />
      </div>

      {/* Per-image caption */}
      {activeCaption && (
        <p className="text-xs text-muted-foreground leading-relaxed">{activeCaption}</p>
      )}

      {/* Thumbnail strip — only when multiple images exist */}
      {galleryImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {galleryImages.map(img => (
            <button
              key={img.id}
              onClick={() => setActiveUrl(img.url)}
              title={img.caption ?? undefined}
              className={`shrink-0 w-16 h-16 border overflow-hidden bg-muted transition-opacity ${
                activeUrl === img.url
                  ? "border-black"
                  : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? ""} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
