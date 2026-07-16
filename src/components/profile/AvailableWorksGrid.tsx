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

/** One storefront tile — the tile's width IS the image's rendered width
 *  (stored natural dims when present, else measured onLoad, same pattern as
 *  StudioUpdateTile). The caption wraps to that width and the price pill pins
 *  to the image's own corner — no white gutter beside narrow works. */
function Tile({ work, onOpen, detailHref }: {
  work: AvailableArtwork;
  onOpen?: () => void;
  detailHref?: string;
}) {
  const dims = work as { natural_width?: number | null; natural_height?: number | null };
  const [tileW, setTileW] = useState<number | null>(
    dims.natural_width && dims.natural_height
      ? Math.round(TILE_H * (dims.natural_width / dims.natural_height))
      : null
  );

  // Stored natural dims are only a pre-load estimate — they can be stale
  // (e.g. the image was replaced). The loaded file's real dimensions win.
  function measure(img: HTMLImageElement) {
    if (img.naturalWidth && img.naturalHeight) {
      const measured = Math.round(TILE_H * (img.naturalWidth / img.naturalHeight));
      setTileW((prev) => (prev === measured ? prev : measured));
    }
  }

  // Cached images finish loading before hydration, so onLoad never fires for
  // them — the ref callback catches already-complete images on mount.
  function imgRef(node: HTMLImageElement | null) {
    if (node?.complete) measure(node);
  }

  const title = work.title ?? work.caption ?? "Untitled";
  const price = !work.hide_price ? formatPrice(work.price_cents, work.price_currency, work.is_poa) : null;

  const inner = (
    <>
      <div className="relative overflow-hidden bg-card" style={{ height: TILE_H }}>
        {work.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={work.url}
            alt={title}
            loading="lazy"
            onLoad={(e) => measure(e.currentTarget)}
            className="block w-auto max-w-none"
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
        {work.year ? <span className="font-normal text-muted-foreground">, {work.year}</span> : null}
      </p>
    </>
  );

  const style = tileW ? { width: tileW } : undefined;

  return detailHref ? (
    <Link href={detailHref} className="block text-left" style={style}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className="block text-left" style={style}>
      {inner}
    </button>
  );
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
        {artworks.map((w) =>
          isOwner ? (
            <Tile
              key={w.id}
              work={w}
              detailHref={`/${username}/works/${(w as { slug?: string | null }).slug ?? w.id}`}
            />
          ) : (
            <Tile key={w.id} work={w} onOpen={() => setActiveId(w.id)} />
          )
        )}
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
