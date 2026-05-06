"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PlaceInCollectionModal } from "./PlaceInCollectionModal";
import { unlistWork, toggleHideAvailable } from "@/app/profile/available-work-actions";
import { formatPrice } from "@/lib/format-price";
import type { Artwork } from "@/types/database";

export const CARD_W = 200;
export const CARD_IMG_H = 200;

interface Props {
  img: Artwork;
  artistId: string;
  artistName: string;
  artistUsername: string;
  viewerRole: string | null;
  isOwner: boolean;
  onRemove?: (id: string) => void;
}

export function AvailableWorkCard({ img, artistId, artistUsername, isOwner, onRemove }: Props) {
  const [hidden, setHidden] = useState(img.hide_available);
  const [unlisting, setUnlisting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [collectModal, setCollectModal] = useState(false);

  const displayPrice = !img.hide_price ? formatPrice(img.price_cents, img.price_currency ?? "NZD", img.is_poa) : null;
  const title = img.caption ?? img.title ?? "Untitled";
  const href = `/${artistUsername}/works/${img.id}`;

  async function handleUnlist(e: React.MouseEvent) {
    e.preventDefault();
    setUnlisting(true);
    await unlistWork(img.id);
    onRemove?.(img.id);
  }

  async function handleHideToggle() {
    setToggling(true);
    const next = !hidden;
    setHidden(next);
    await toggleHideAvailable(img.id, next);
    setToggling(false);
  }

  return (
    <>
      {collectModal && (
        <PlaceInCollectionModal
          artworkId={img.id}
          artworkTitle={img.caption}
          onClose={() => setCollectModal(false)}
          onSuccess={() => onRemove?.(img.id)}
        />
      )}

      <div style={{ width: CARD_W, flexShrink: 0 }}>
        {/* Clickable card */}
        <Link href={href} className="group block relative">
          {/* Unlist button — owner hover overlay */}
          {isOwner && (
            <button
              onClick={handleUnlist}
              disabled={unlisting}
              aria-label="Unlist work"
              className="absolute top-1.5 right-1.5 z-10 w-5 h-5 bg-white border border-stone-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-stone-100 disabled:opacity-40"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Image */}
          <div
            className="overflow-hidden bg-stone-100"
            style={{ width: CARD_W, height: CARD_IMG_H }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>

          {/* Title + price */}
          <div className="pt-2 pb-1">
            {isOwner && hidden && (
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                Hidden
              </span>
            )}
            <p
              className="text-xs font-medium leading-snug text-foreground"
              style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}
            >
              {title}
            </p>
            {displayPrice && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{displayPrice}</p>
            )}
          </div>
        </Link>

        {/* Owner management controls */}
        {isOwner && (
          <div className="flex gap-3 mt-0.5">
            <button
              onClick={handleHideToggle}
              disabled={toggling}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {hidden ? "Show" : "Hide"}
            </button>
            <button
              onClick={() => setCollectModal(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Collected
            </button>
          </div>
        )}
      </div>
    </>
  );
}
