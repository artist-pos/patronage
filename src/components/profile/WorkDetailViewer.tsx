"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ZoomableImage } from "@/components/ui/ZoomableImage";
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
  const [captionOpacity, setCaptionOpacity] = useState(1);

  const hasMultiple = images.length > 1;
  const activeImg = images[activeIndex] ?? null;
  const activeUrl = activeImg?.url ?? primaryUrl;
  const activeCaption = activeImg?.caption?.trim() || null;

  // Fade caption out then in whenever the active image changes
  useEffect(() => {
    setCaptionOpacity(0);
    const t = setTimeout(() => setCaptionOpacity(1), 80);
    return () => clearTimeout(t);
  }, [activeIndex]);

  function handlePrev() {
    setActiveIndex(i => (i - 1 + images.length) % images.length);
  }

  function handleNext() {
    setActiveIndex(i => (i + 1) % images.length);
  }

  return (
    <div className="space-y-3">
      {/* Fixed-height image viewport — prevents layout shift when switching
          images. The artwork itself is pinch / double-tap zoomable. */}
      <div className="relative bg-background overflow-hidden h-[60vh] sm:h-[600px]">
        <ZoomableImage
          key={activeUrl}
          src={activeUrl}
          alt={activeCaption ?? caption}
          className="w-full h-full"
        />

        {hasMultiple && (
          <>
            <button
              onClick={handlePrev}
              className="absolute z-10 left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background border border-border p-1.5 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              className="absolute z-10 right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background border border-border p-1.5 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Caption area — always rendered at fixed min-height to prevent layout shift */}
      <div
        className="min-h-[2.5rem] transition-opacity duration-300"
        style={{ opacity: captionOpacity }}
      >
        {activeCaption && (
          <p className="text-sm text-neutral-500 leading-relaxed">{activeCaption}</p>
        )}
      </div>

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
