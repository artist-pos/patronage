"use client";

import { useState } from "react";
import { EnquireButton } from "@/components/profile/EnquireButton";
import { MakeOfferModal } from "@/components/profile/MakeOfferModal";
import { BuyWorkButton } from "@/components/profile/BuyWorkButton";
import { formatPrice } from "@/lib/format-price";

interface Props {
  artistId: string;
  artistName: string;
  artworkId: string;
  workTitle: string | null;
  workDescription: string | null;
  priceCents: number | null;
  isPoa: boolean;
  priceCurrency: "NZD" | "AUD";
  hidePrice: boolean;
  listingMode: "direct_sale" | "enquire_first";
  // When set, overrides multi-button layout with a single mode-driven CTA
  acquisitionMode?: "buy_now" | "make_offer" | "enquire_first";
  workImageUrl?: string | null;
  year?: number | null;
  medium?: string | null;
  dimensions?: string | null;
  edition?: string | null;
}

export function WorkDetailActions({
  artistId,
  artistName,
  artworkId,
  workTitle,
  workDescription,
  priceCents,
  isPoa,
  priceCurrency,
  hidePrice,
  listingMode,
  acquisitionMode,
  workImageUrl,
  year,
  medium,
  dimensions,
  edition,
}: Props) {
  const [offerOpen, setOfferOpen] = useState(false);

  const displayPrice = !hidePrice ? formatPrice(priceCents, priceCurrency, isPoa) : null;

  // When acquisitionMode is set, render a single mode-driven CTA
  if (acquisitionMode) {
    const showPrice = acquisitionMode !== "enquire_first";
    const priceLabel = showPrice ? displayPrice : null;
    const poaLabel = showPrice && !displayPrice && !hidePrice ? "Price on application" : null;

    return (
      <>
        {offerOpen && (
          <MakeOfferModal
            open={offerOpen}
            onClose={() => setOfferOpen(false)}
            artistId={artistId}
            workId={artworkId}
            workTitle={workTitle}
            listingPriceCents={priceCents}
            listingCurrency={priceCurrency}
          />
        )}
        <div className="space-y-3 py-4 border-t border-border border-b">
          {priceLabel && <p className="text-sm font-medium">{priceLabel}</p>}
          {poaLabel && <p className="text-sm text-muted-foreground">{poaLabel}</p>}
          {acquisitionMode === "buy_now" && (
            <BuyWorkButton
              artworkId={artworkId}
              workTitle={workTitle}
              priceCents={priceCents!}
              currency={priceCurrency}
              workImageUrl={workImageUrl}
              year={year}
              medium={medium}
              dimensions={dimensions}
              edition={edition}
              artistName={artistName}
            />
          )}
          {acquisitionMode === "make_offer" && (
            <button
              onClick={() => setOfferOpen(true)}
              className="w-full bg-black text-white text-sm py-2 px-4 hover:opacity-80 transition-opacity"
            >
              Make an Offer
            </button>
          )}
          {acquisitionMode === "enquire_first" && (
            <EnquireButton
              artistId={artistId}
              artistName={artistName}
              workId={artworkId}
              workTitle={workTitle}
              workDescription={workDescription}
              label="Enquire about this work"
              className="w-full bg-black text-white text-sm py-2 px-4 hover:opacity-80 transition-opacity"
            />
          )}
        </div>
      </>
    );
  }

  // Legacy multi-button layout (used when acquisitionMode is not set)
  const canBuy = listingMode === "direct_sale" && !!priceCents && priceCents > 0 && !isPoa;

  return (
    <>
      {offerOpen && (
        <MakeOfferModal
          open={offerOpen}
          onClose={() => setOfferOpen(false)}
          artistId={artistId}
          workId={artworkId}
          workTitle={workTitle}
          listingPriceCents={priceCents}
          listingCurrency={priceCurrency}
        />
      )}

      <div className="space-y-3 py-4 border-t border-border border-b">
        {displayPrice && (
          <p className="text-sm font-medium">{displayPrice}</p>
        )}
        {!displayPrice && !hidePrice && (
          <p className="text-sm text-muted-foreground">Price on application</p>
        )}

        <div className="flex flex-col gap-2">
          {canBuy && listingMode === "direct_sale" ? (
            <BuyWorkButton
              artworkId={artworkId}
              workTitle={workTitle}
              priceCents={priceCents!}
              currency={priceCurrency}
              workImageUrl={workImageUrl}
              year={year}
              medium={medium}
              dimensions={dimensions}
              edition={edition}
              artistName={artistName}
            />
          ) : (
            <EnquireButton
              artistId={artistId}
              artistName={artistName}
              workId={artworkId}
              workTitle={workTitle}
              workDescription={workDescription}
              className="w-full bg-black text-white text-sm py-2 px-4 hover:opacity-80 transition-opacity"
            />
          )}

          <button
            onClick={() => setOfferOpen(true)}
            className="w-full border border-black text-sm py-2 px-4 hover:bg-stone-50 transition-colors"
          >
            Make an Offer
          </button>

          {canBuy && listingMode === "direct_sale" && (
            <EnquireButton
              artistId={artistId}
              artistName={artistName}
              workId={artworkId}
              workTitle={workTitle}
              workDescription={workDescription}
            />
          )}
        </div>
      </div>
    </>
  );
}
