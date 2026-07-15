"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="text-xs text-muted-foreground leading-relaxed">
      <p className={expanded ? undefined : "line-clamp-4"}>{text}</p>
      {text.length > 160 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-0.5 text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
import { WorkDetailActions } from "@/components/profile/WorkDetailActions";
import { formatPrice } from "@/lib/format-price";
import type { EditionOption } from "@/components/feed/WorksJustifiedGrid";

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title: string;
  artistName: string;
  metaLine?: string | null;
  description?: string | null;
  artistId: string;
  artworkId: string;
  workDescription: string | null;
  priceCents: number | null;
  isPoa: boolean;
  priceCurrency: "NZD" | "AUD";
  hidePrice: boolean;
  listingMode: "direct_sale" | "enquire_first";
  acquisitionMode: "buy_now" | "make_offer" | "enquire_first";
  year?: number | null;
  medium?: string | null;
  dimensions?: string | null;
  editions?: EditionOption[];
}

export function WorkPurchaseModal({
  open,
  onClose,
  imageUrl,
  title,
  artistName,
  metaLine,
  description,
  artistId,
  artworkId,
  workDescription,
  priceCents,
  isPoa,
  priceCurrency,
  hidePrice,
  listingMode,
  acquisitionMode,
  year,
  medium,
  dimensions,
  editions,
}: Props) {
  const [editionIndex, setEditionIndex] = useState(0);

  useEffect(() => { setEditionIndex(0); }, [artworkId]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Derive price + mode from selected edition, same logic as WorksLightbox
  const selectedEdition = editions?.[editionIndex] ?? null;
  const derivedPriceCents = selectedEdition?.price_cents ?? priceCents;
  const derivedIsPoa = selectedEdition?.poa ?? isPoa;
  const derivedCurrency = (selectedEdition?.currency as "NZD" | "AUD") ?? priceCurrency;
  const derivedListingMode: "direct_sale" | "enquire_first" = selectedEdition
    ? (selectedEdition.listing_mode === "direct" ? "direct_sale" : "enquire_first")
    : listingMode;
  const derivedAcquisitionMode = selectedEdition
    ? (selectedEdition.listing_mode === "direct" ? "buy_now" : "enquire_first") as "buy_now" | "enquire_first"
    : acquisitionMode;

  const formattedPrice = !hidePrice ? formatPrice(derivedPriceCents, derivedCurrency, derivedIsPoa) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm z-10"
        aria-label="Close"
      >
        <X className="w-4 h-4 text-stone-600" />
      </button>

      <div
        className="flex flex-col sm:flex-row overflow-hidden shadow-2xl bg-white w-[95vw] sm:w-auto sm:max-w-[95vw]"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image panel. On mobile it's a fixed-height, full-width letterbox
            (object-contain — never cropped or squished). On desktop the box
            auto-sizes to the artwork's natural aspect, capped by max-height /
            max-width so wide works can't distort. */}
        {imageUrl && (
          <div className="relative shrink-0 flex items-center justify-center bg-stone-100 w-full h-[42vh] sm:h-auto sm:w-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title}
              className="block w-auto h-auto max-w-full sm:max-w-[60vw] max-h-[42vh] sm:max-h-[85vh]"
            />
          </div>
        )}

        {/* Info panel */}
        <div
          className="bg-white flex flex-col w-full sm:w-[300px] shrink-0 min-h-0 overflow-y-auto"
        >
          <div className="flex-1 p-6 space-y-4">
            {/* Title + artist + meta */}
            <div className="space-y-1">
              <h2 className="text-sm font-semibold leading-snug">{title}</h2>
              <p className="text-xs text-muted-foreground">{artistName}</p>
              {metaLine && <p className="text-xs text-muted-foreground">{metaLine}</p>}
            </div>

            {description && <ExpandableDescription text={description} />}

            {/* Edition selector */}
            {editions && editions.length >= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                {editions.map((ed, i) => (
                  <button
                    key={ed.id}
                    type="button"
                    onClick={() => editions.length > 1 && setEditionIndex(i)}
                    className={`text-xs px-2.5 py-1 border rounded transition-colors ${
                      editionIndex === i
                        ? "border-black bg-black text-white"
                        : editions.length > 1
                          ? "border-border hover:border-stone-400 cursor-pointer"
                          : "border-border cursor-default"
                    }`}
                  >
                    {ed.label}{ed.dimensions ? ` · ${ed.dimensions}` : ""}
                  </button>
                ))}
              </div>
            )}

            {/* Price + CTA */}
            <div className="space-y-3 pt-1 border-t border-border">
              {formattedPrice && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm font-medium">{formattedPrice}</span>
                </div>
              )}

              <WorkDetailActions
                artistId={artistId}
                artistName={artistName}
                artworkId={artworkId}
                workTitle={title}
                workDescription={workDescription}
                priceCents={derivedPriceCents}
                isPoa={derivedIsPoa}
                priceCurrency={derivedCurrency}
                hidePrice={hidePrice}
                listingMode={derivedListingMode}
                acquisitionMode={derivedAcquisitionMode}
                workImageUrl={imageUrl}
                year={year}
                medium={medium}
                dimensions={dimensions}
                edition={selectedEdition?.label ?? undefined}
                editions={editions}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
