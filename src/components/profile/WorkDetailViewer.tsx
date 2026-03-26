"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WorkImage } from "@/types/database";

interface Props {
  primaryUrl: string;
  galleryImages: WorkImage[];
  caption: string;
}

export function WorkDetailViewer({ primaryUrl, galleryImages, caption }: Props) {
  // Images sorted by position; fall back to a synthetic single-image list
  const images: WorkImage[] = galleryImages.length > 0
    ? [...galleryImages].sort((a, b) => a.position - b.position)
    : [];

  const defaultIndex = Math.max(0, images.findIndex(i => i.is_primary));
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  const hasMultiple = images.length > 1;
  const activeImg = images[activeIndex] ?? null;
  const activeUrl = activeImg?.url ?? primaryUrl;
  const activeCaption = activeImg?.caption?.trim() || caption;

  function handlePrev() {
    setActiveIndex(i => (i - 1 + images.length) % images.length);
  }

  function handleNext() {
    setActiveIndex(i => (i + 1) % images.length);
  }

  return (
    <div className="space-y-3">
      {/* Fixed-height image viewport — prevents layout shift when switching images */}
      <div
        className="relative bg-background overflow-hidden flex items-center justify-center"
        style={{ height: 600 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activeUrl}
          src={activeUrl}
          alt={activeCaption ?? ""}
          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", display: "block" }}
        />

        {hasMultiple && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background border border-border p-1.5 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background border border-border p-1.5 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Per-image caption */}
      {activeCaption && (
        <p className="text-xs text-muted-foreground leading-relaxed">{activeCaption}</p>
      )}

      {/* Thumbnail strip — only when multiple images */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(idx)}
              title={img.caption ?? undefined}
              className={`shrink-0 w-16 h-16 border overflow-hidden bg-muted transition-opacity ${
                idx === activeIndex
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
