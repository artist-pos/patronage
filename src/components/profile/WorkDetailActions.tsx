"use client";

import { useState } from "react";
import { EnquireButton } from "@/components/profile/EnquireButton";
import { MakeOfferModal } from "@/components/profile/MakeOfferModal";

interface Props {
  artistId: string;
  artistName: string;
  artworkId: string;
  workTitle: string | null;
  workDescription: string | null;
  price: string | null;
  priceCurrency: "NZD" | "AUD";
  hidePrice: boolean;
}

function formatPrice(price: string, currency: string): string {
  if (price === "POA") return "Price on application";
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return `${currency} ${num.toLocaleString("en-NZ")}`;
}

export function WorkDetailActions({
  artistId,
  artistName,
  artworkId,
  workTitle,
  workDescription,
  price,
  priceCurrency,
  hidePrice,
}: Props) {
  const [offerOpen, setOfferOpen] = useState(false);

  const displayPrice = !hidePrice && price ? formatPrice(price, priceCurrency) : null;

  return (
    <>
      {offerOpen && (
        <MakeOfferModal
          open={offerOpen}
          onClose={() => setOfferOpen(false)}
          artistId={artistId}
          workId={artworkId}
          workTitle={workTitle}
          listingPrice={price}
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
          <button
            onClick={() => setOfferOpen(true)}
            className="w-full bg-black text-white text-sm py-2 px-4 hover:opacity-80 transition-opacity"
          >
            Make an Offer
          </button>
          <EnquireButton
            artistId={artistId}
            artistName={artistName}
            workId={artworkId}
            workTitle={workTitle}
            workDescription={workDescription}
          />
        </div>
      </div>
    </>
  );
}
