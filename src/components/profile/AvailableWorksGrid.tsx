"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format-price";
import { WorkPurchaseModal } from "@/components/profile/WorkPurchaseModal";
import type { Artwork } from "@/types/database";
import type { EditionOption } from "@/components/feed/WorksJustifiedGrid";

const TILE_H = 300;

type AvailableArtwork = Artwork & { editions?: EditionOption[] };

interface Props {
  artworks: AvailableArtwork[];
  artistId: string;
  artistName: string;
  username: string;
  isOwner: boolean;
}

/**
 * The profile storefront grid — every available work as a tile. Clicking a
 * tile opens the commerce modal (WorkPurchaseModal: image + price + buy/
 * enquire actions), NOT the artwork detail page. Owners get the detail page
 * instead so they can't accidentally start a checkout on their own work.
 */
export function AvailableWorksGrid({ artworks, artistId, artistName, username, isOwner }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? artworks.find((a) => a.id === activeId) ?? null : null;

  const activeMeta = active
    ? [active.year && String(active.year), active.medium, active.dimensions].filter(Boolean).join(" · ")
    : null;

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        {artworks.map((w) => {
          const title = w.title ?? w.caption ?? "Untitled";
          const price = !w.hide_price ? formatPrice(w.price_cents, w.price_currency, w.is_poa) : null;

          const tile = (
            <>
              <div className="relative overflow-hidden bg-card" style={{ height: TILE_H }}>
                {w.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.url}
                    alt={title}
                    loading="lazy"
                    className="block w-auto"
                    style={{ height: TILE_H }}
                  />
                )}
                {price && (
                  <span className="absolute bottom-1.5 right-1.5 bg-white/90 px-2 py-0.5 font-mono text-[10px] font-medium text-stone-800">
                    {price}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs font-medium">
                {title}
                {w.year ? <span className="font-normal text-muted-foreground">, {w.year}</span> : null}
              </p>
            </>
          );

          return isOwner ? (
            <Link
              key={w.id}
              href={`/${username}/works/${(w as { slug?: string | null }).slug ?? w.id}`}
              className="block text-left"
            >
              {tile}
            </Link>
          ) : (
            <button key={w.id} type="button" onClick={() => setActiveId(w.id)} className="block text-left">
              {tile}
            </button>
          );
        })}
      </div>

      {active && (
        <WorkPurchaseModal
          open
          onClose={() => setActiveId(null)}
          imageUrl={active.url}
          title={active.title ?? active.caption ?? "Untitled"}
          artistName={artistName}
          metaLine={activeMeta}
          description={active.description}
          artistId={artistId}
          artworkId={active.id}
          workDescription={active.description}
          priceCents={active.price_cents}
          isPoa={active.is_poa}
          priceCurrency={active.price_currency}
          hidePrice={active.hide_price}
          listingMode={active.listing_mode}
          acquisitionMode={active.acquisition_mode}
          year={active.year}
          medium={active.medium}
          dimensions={active.dimensions}
          editions={active.editions}
        />
      )}
    </>
  );
}
