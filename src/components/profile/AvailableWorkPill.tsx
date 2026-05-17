"use client";

import { useState } from "react";
import { WorkPurchaseModal } from "@/components/profile/WorkPurchaseModal";
import type { EditionOption } from "@/components/feed/WorksJustifiedGrid";

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
  acquisitionMode: "buy_now" | "make_offer" | "enquire_first";
  workImageUrl?: string | null;
  year?: number | null;
  medium?: string | null;
  dimensions?: string | null;
  metaLine?: string | null;
  editions?: EditionOption[];
}

export function AvailableWorkPill({
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
  metaLine,
  editions,
}: Props) {
  const [open, setOpen] = useState(false);
  const title = workTitle ?? "Untitled";

  return (
    <>
      <WorkPurchaseModal
        open={open}
        onClose={() => setOpen(false)}
        imageUrl={workImageUrl ?? null}
        title={title}
        artistName={artistName}
        metaLine={metaLine}
        description={workDescription}
        artistId={artistId}
        artworkId={artworkId}
        workDescription={workDescription}
        priceCents={priceCents}
        isPoa={isPoa}
        priceCurrency={priceCurrency}
        hidePrice={hidePrice}
        listingMode={listingMode}
        acquisitionMode={acquisitionMode}
        year={year}
        medium={medium}
        dimensions={dimensions}
        editions={editions}
      />

      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 bg-stone-100 text-[10px] font-medium text-stone-700 px-2.5 py-1 rounded-full hover:bg-stone-200 transition-colors whitespace-nowrap"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        For sale
      </button>
    </>
  );
}
