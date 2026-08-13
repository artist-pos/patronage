"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Props {
  /** id of the server-rendered article body to watch for figure clicks. */
  containerId: string;
}

/**
 * Lightbox for in-line body figures. Attaches a delegated click listener to the
 * article container rather than rendering it, so the post HTML is never
 * serialised into the client payload.
 */
export function BlogBodyZoom({ containerId }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG" || !target.closest("figure")) return;
      const img = target as HTMLImageElement;
      setLightbox(img.currentSrc || img.src);
    }
    container.addEventListener("click", onClick);
    return () => container.removeEventListener("click", onClick);
  }, [containerId]);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (!lightbox) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={() => setLightbox(null)}
    >
      <button
        onClick={() => setLightbox(null)}
        className="absolute right-4 top-4 text-foreground/50 transition-colors hover:text-foreground"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightbox}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}
