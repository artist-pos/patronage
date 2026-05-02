"use client";

import { useState } from "react";
import { EnquireModal } from "./EnquireModal";

interface Props {
  artistId: string;
  artistName: string;
  workId?: string | null;
  workTitle: string | null;
  workDescription?: string | null;
  workImageUrl?: string | null;
  listingPrice?: string | null;
  listingCurrency?: string | null;
}

export function EnquireButton({ artistId, workId, workTitle, workImageUrl, listingPrice, listingCurrency }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EnquireModal
        open={open}
        onClose={() => setOpen(false)}
        artistId={artistId}
        workId={workId}
        workTitle={workTitle}
        workImageUrl={workImageUrl}
        listingPrice={listingPrice}
        listingCurrency={listingCurrency}
      />
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-black text-xs py-1.5 px-3 hover:bg-muted/40 transition-colors"
      >
        Enquire
      </button>
    </>
  );
}
