"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { WorkDetailActions } from "@/components/profile/WorkDetailActions";
import type { SeriesWork } from "@/types/database";

interface Props {
  artworks: SeriesWork[];
  initialIndex: number;
  artistId: string;
  artistName: string;
  artistUsername: string;
  viewer: { id: string } | null;
  onClose: () => void;
}

export function SeriesLightbox({ artworks, initialIndex, artistId, artistName, artistUsername, viewer, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const work = artworks[index];
  const hasPrev = index > 0;
  const hasNext = index < artworks.length - 1;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) setIndex(i => i - 1);
      if (e.key === "ArrowRight" && hasNext) setIndex(i => i + 1);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [hasPrev, hasNext, onClose]);

  const isAvailable = work.is_available && !work.hide_price;
  const metaLine = [work.medium, work.year ? String(work.year) : null, work.dimensions].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
          <span className="text-xs text-muted-foreground">
            {index + 1} of {artworks.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIndex(i => i - 1)}
              disabled={!hasPrev}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              aria-label="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setIndex(i => i + 1)}
              disabled={!hasNext}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Image */}
          <div className="flex-1 min-h-0 bg-stone-50 flex items-center justify-center overflow-hidden p-4">
            {work.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={work.url}
                alt={work.title ?? work.caption ?? ""}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-stone-100" />
            )}
          </div>

          {/* Details sidebar */}
          <div className="md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-border overflow-y-auto p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold leading-snug">
                {work.title ?? work.caption ?? "Untitled"}
              </h2>
              {metaLine && (
                <p className="text-xs text-muted-foreground mt-1">{metaLine}</p>
              )}
            </div>

            {isAvailable && viewer ? (
              <WorkDetailActions
                artistId={artistId}
                artistName={artistName}
                artworkId={work.id}
                workTitle={work.title ?? work.caption}
                workDescription={null}
                priceCents={work.price_cents}
                isPoa={work.is_poa}
                priceCurrency={work.price_currency as "NZD" | "AUD"}
                hidePrice={work.hide_price}
                listingMode={(work.listing_mode ?? "enquire_first") as "direct_sale" | "enquire_first"}
                acquisitionMode={(work.acquisition_mode ?? "enquire_first") as "buy_now" | "make_offer" | "enquire_first"}
                workImageUrl={work.url}
                year={work.year}
                medium={work.medium}
                dimensions={work.dimensions}
                editions={work.editions}
              />
            ) : isAvailable && !viewer ? (
              <div className="py-4 border-t border-border">
                <Link
                  href="/auth/login"
                  className="w-full block text-center bg-black text-white text-sm py-2 px-4 hover:opacity-80 transition-opacity"
                >
                  Sign in to enquire
                </Link>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">This work is not currently for sale.</p>
            )}

            {work.slug && (
              <Link
                href={`/${artistUsername}/works/${work.slug}`}
                className="block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                View full work page →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
