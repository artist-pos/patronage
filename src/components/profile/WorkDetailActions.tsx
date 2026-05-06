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
  workImageUrl,
  year,
  medium,
  dimensions,
  edition,
}: Props) {
  const [offerOpen, setOfferOpen] = useState(false);

  const displayPrice = !hidePrice ? formatPrice(priceCents, priceCurrency, isPoa) : null;
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
          {/* Primary action */}
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

          {/* Secondary actions */}
          <button
            onClick={() => setOfferOpen(true)}
            className="w-full border border-black text-sm py-2 px-4 hover:bg-stone-50 transition-colors"
          >
            Make an Offer
          </button>

          {/* Enquire shown as secondary when Buy is primary */}
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
