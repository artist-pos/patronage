"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  imageUrl: string;
  imageUrl2?: string | null;
}

export function BlogImages({ imageUrl, imageUrl2 }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <>
      <div className="flex gap-2">
        <img
          src={imageUrl}
          alt=""
          onClick={() => setLightbox(imageUrl)}
          className="flex-1 min-w-0 object-cover rounded-xl cursor-zoom-in"
          style={imageUrl2 ? { maxHeight: "480px" } : undefined}
        />
        {imageUrl2 && (
          <img
            src={imageUrl2}
            alt=""
            onClick={() => setLightbox(imageUrl2)}
            className="flex-1 min-w-0 object-cover rounded-xl cursor-zoom-in"
            style={{ maxHeight: "480px" }}
          />
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-foreground/50 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}
