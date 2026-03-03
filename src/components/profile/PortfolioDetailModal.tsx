"use client";

import { useEffect } from "react";
import type { PortfolioImage } from "@/types/database";

interface Props {
  img: PortfolioImage;
  onClose: () => void;
  artistName?: string;
  viewerRole?: string | null;
}

export function PortfolioDetailModal({ img, onClose, artistName, viewerRole }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const showCredit =
    artistName &&
    (viewerRole === "patron" || viewerRole === "partner");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-black w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative flex-1 bg-muted overflow-hidden min-h-[300px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption ?? "Portfolio work"}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>

        {/* Metadata sidebar */}
        <div
          className="flex flex-col gap-3 p-6 border-t sm:border-t-0 sm:border-l border-border flex-none"
          style={{ width: 220 }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-xs text-muted-foreground hover:text-foreground self-end"
          >
            ✕
          </button>

          {img.caption && (
            <p className="text-sm font-bold leading-snug">{img.caption}</p>
          )}

          {img.price && (
            <p className="text-xs text-muted-foreground">{img.price}</p>
          )}

          {img.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {img.description}
            </p>
          )}

          {showCredit && (
            <p className="text-xs text-muted-foreground mt-auto pt-4 border-t border-border">
              by {artistName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
