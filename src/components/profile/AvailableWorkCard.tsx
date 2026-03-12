"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { EnquireButton } from "./EnquireButton";
import { MakeOfferModal } from "./MakeOfferModal";
import { PlaceInCollectionModal } from "./PlaceInCollectionModal";
import { unlistWork, toggleHideAvailable } from "@/app/profile/available-work-actions";
import type { Artwork } from "@/types/database";

function formatPrice(price: string | null, currency: string): string | null {
  if (!price) return null;
  if (price === "POA") return "Price on application";
  const num = parseFloat(price.replace(/,/g, ""));
  if (isNaN(num)) return price;
  return `${currency} ${num.toLocaleString("en-NZ")}`;
}

const CARD_H = 225;
const META_W = 200;

interface Props {
  img: Artwork;
  artistId: string;
  artistName: string;
  artistUsername: string;
  viewerRole: string | null;
  isOwner: boolean;
  onRemove?: (id: string) => void;
}

export function AvailableWorkCard({ img, artistId, artistName, artistUsername, viewerRole, isOwner, onRemove }: Props) {
  const canEnquire = !isOwner && viewerRole !== null;
  const [hidden, setHidden] = useState(img.hide_available);
  const [unlisting, setUnlisting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [collectModal, setCollectModal] = useState(false);
  const [offerModal, setOfferModal] = useState(false);

  const displayPrice = !img.hide_price
    ? formatPrice(img.price, img.price_currency ?? "NZD")
    : null;

  async function handleUnlist() {
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
    {offerModal && (
      <MakeOfferModal
        open={offerModal}
        onClose={() => setOfferModal(false)}
        artistId={artistId}
        workId={img.id}
        workTitle={img.caption}
        listingPrice={img.price}
        listingCurrency={(img.price_currency as "NZD" | "AUD") ?? "NZD"}
      />
    )}
    <div
      className="flex-none flex flex-row border border-border bg-background snap-start overflow-hidden"
      style={{ height: CARD_H, boxSizing: "border-box" }}
    >
      {/* Left: image — natural aspect ratio, fixed height */}
      <div className="relative overflow-hidden bg-muted flex-none group" style={{ height: CARD_H }}>
        <Link href={`/${artistUsername}/works/${img.id}`} tabIndex={-1}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption ?? "Available work"}
            style={{ height: CARD_H, width: "auto", display: "block" }}
          />
        </Link>

        {/* X button — unlist (owner only) */}
        {isOwner && (
          <button
            onClick={handleUnlist}
            disabled={unlisting}
            aria-label="Unlist work"
            className="absolute top-1 right-1 w-5 h-5 bg-background border border-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black hover:text-white disabled:opacity-40"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Right: metadata */}
      <div
        className="flex flex-col gap-2 p-4 border-l border-border"
        style={{ width: META_W }}
      >
        <div className="flex flex-col gap-1.5 flex-1 min-h-0">
          {/* Hidden badge (owner only) */}
          {isOwner && hidden && (
            <span className="text-[10px] font-mono uppercase tracking-widest border border-border px-1.5 py-0.5 self-start leading-none text-muted-foreground">
              Hidden
            </span>
          )}

          {/* Title */}
          {img.caption && (
            <p className="text-sm font-semibold leading-snug line-clamp-3">
              {img.caption.slice(0, 140)}
            </p>
          )}

          {/* Price */}
          {displayPrice && (
            <p className="text-xs text-muted-foreground">{displayPrice}</p>
          )}

          {/* Description */}
          {img.description && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-5">
              {img.description.slice(0, 560)}
            </p>
          )}
        </div>

        {/* Bottom actions */}
        <div className="mt-auto flex flex-col gap-2">
          {/* Owner controls */}
          {isOwner && (
            <div className="flex flex-col gap-1">
              <button
                onClick={handleHideToggle}
                disabled={toggling}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors self-start disabled:opacity-40"
              >
                {hidden ? "Show" : "Hide"}
              </button>
              <button
                onClick={() => setCollectModal(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors self-start"
              >
                Mark as collected
              </button>
            </div>
          )}

          {/* Enquire / Offer buttons (non-owner authenticated) */}
          {canEnquire && (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setOfferModal(true)}
                className="w-full bg-black text-white text-xs py-1.5 px-3 hover:opacity-80 transition-opacity"
              >
                Make an Offer
              </button>
              <EnquireButton
                artistId={artistId}
                artistName={artistName}
                workId={img.id}
                workTitle={img.caption}
                workDescription={img.description}
              />
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
