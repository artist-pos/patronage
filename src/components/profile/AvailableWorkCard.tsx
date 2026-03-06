"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { EnquireButton } from "./EnquireButton";
import { unlistWork, toggleHideAvailable } from "@/app/profile/available-work-actions";
import type { Artwork } from "@/types/database";

const CARD_H = 225;
const META_W = 200;

interface Props {
  img: Artwork;
  artistId: string;
  artistName: string;
  viewerRole: string | null;
  isOwner: boolean;
  onRemove?: (id: string) => void;
}

export function AvailableWorkCard({ img, artistId, artistName, viewerRole, isOwner, onRemove }: Props) {
  const canEnquire = !isOwner && viewerRole !== null;
  const [hidden, setHidden] = useState(img.hide_available);
  const [unlisting, setUnlisting] = useState(false);
  const [toggling, setToggling] = useState(false);

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
    <div
      className="flex-none flex flex-row border border-border bg-background snap-start overflow-hidden"
      style={{ height: CARD_H, boxSizing: "border-box" }}
    >
      {/* Left: image — natural aspect ratio, fixed height */}
      <div className="relative overflow-hidden bg-muted flex-none group" style={{ height: CARD_H }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Available work"}
          style={{ height: CARD_H, width: "auto", display: "block" }}
        />

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
          {img.price && (
            <p className="text-xs text-muted-foreground">{img.price}</p>
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
          {/* Hide / Show toggle (owner only) */}
          {isOwner && (
            <button
              onClick={handleHideToggle}
              disabled={toggling}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors self-start disabled:opacity-40"
            >
              {hidden ? "Show" : "Hide"}
            </button>
          )}

          {/* Enquire button (non-owner authenticated) */}
          {canEnquire && (
            <EnquireButton
              artistId={artistId}
              artistName={artistName}
              workId={img.id}
              workTitle={img.caption}
              workDescription={img.description}
            />
          )}
        </div>
      </div>
    </div>
  );
}
