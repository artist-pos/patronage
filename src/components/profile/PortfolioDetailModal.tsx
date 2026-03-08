"use client";

import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { PortfolioImage } from "@/types/database";
import { trackEvent } from "@/actions/trackEvent";

interface Props {
  img: PortfolioImage;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  artistName?: string;
  viewerRole?: string | null;
  profileId?: string;
}

export function PortfolioDetailModal({ img, onClose, onPrev, onNext, hasPrev, hasNext, artistName, viewerRole, profileId }: Props) {
  useEffect(() => {
    if (profileId) {
      trackEvent("artwork_view", { profile_id: profileId, artwork_id: img.id }).catch(() => {});
    }
  }, [img.id, profileId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (e.key === "ArrowRight" && hasNext) onNext?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const showCredit =
    artistName &&
    (viewerRole === "patron" || viewerRole === "partner");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="
          w-full max-w-4xl h-[70vh] border border-black bg-background overflow-hidden
          grid grid-cols-1 [grid-template-rows:1fr_220px]
          sm:grid-cols-[1fr_260px] sm:[grid-template-rows:1fr]
        "
      >
        {/* ── Image panel ── */}
        <div className="relative overflow-hidden bg-muted group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption ?? "Portfolio work"}
            className="absolute inset-0 w-full h-full object-contain"
          />

          {/* Prev arrow */}
          {hasPrev && (
            <button
              onClick={onPrev}
              aria-label="Previous artwork"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Next arrow */}
          {hasNext && (
            <button
              onClick={onNext}
              aria-label="Next artwork"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── Text panel ── */}
        <div className="border-t border-black sm:border-t-0 sm:border-l flex flex-col overflow-hidden">
          <div className="flex justify-end shrink-0 border-b border-black">
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
