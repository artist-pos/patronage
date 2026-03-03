"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
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
      {/*
        Mobile:  2-row grid — image (1fr) on top, text panel (220px) below
        Desktop: 2-col grid — image (1fr) left, text panel (260px) right
        Fixed 70vh height; border-black outline is continuous on outer div.
      */}
      <div
        className="
          w-full max-w-4xl h-[70vh] border border-black bg-background overflow-hidden
          grid grid-cols-1 [grid-template-rows:1fr_220px]
          sm:grid-cols-[1fr_260px] sm:[grid-template-rows:1fr]
        "
      >
        {/* ── Image panel — flush, no padding ── */}
        <div className="relative overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption ?? "Portfolio work"}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>

        {/* ── Text panel ── */}
        {/* border-t on mobile (divides rows); border-l on desktop (divides columns) */}
        <div className="border-t border-black sm:border-t-0 sm:border-l flex flex-col overflow-hidden">

          {/* X close button — 44×44px touch target, right-aligned, with bottom divider */}
          <div className="flex justify-end shrink-0 border-b border-black">
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable metadata */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
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
          </div>

          {/* Artist attribution — bold name only, pinned to bottom */}
          {showCredit && (
            <div className="shrink-0 px-5 py-4 border-t border-black">
              <p className="text-xs font-bold">{artistName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
