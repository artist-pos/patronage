import Image from "next/image";
import Link from "next/link";
import { EnquireButton } from "./EnquireButton";
import type { PortfolioImage } from "@/types/database";

const CARD_H = 225;

interface Props {
  img: PortfolioImage;
  artistId: string;
  artistName: string;
  viewerRole: string | null;
  isOwner: boolean;
}

export function AvailableWorkCard({ img, artistId, artistName, viewerRole, isOwner }: Props) {
  const canEnquire = !isOwner && (viewerRole === "patron" || viewerRole === "partner");

  return (
    <div className="flex-none flex flex-col gap-1.5" style={{ width: "fit-content" }}>
      <div
        className="border border-border overflow-hidden bg-muted"
        style={{ height: CARD_H, width: "fit-content" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Available work"}
          style={{ height: CARD_H, width: "auto", display: "block" }}
        />
      </div>

      {/* Caption */}
      {img.caption && (
        <p className="text-xs text-muted-foreground leading-snug font-mono truncate" style={{ maxWidth: CARD_H * 1.5 }}>
          {img.caption}
        </p>
      )}

      {/* Price */}
      {img.price && (
        <p className="text-xs font-semibold">{img.price}</p>
      )}

      {/* Actions */}
      {canEnquire && (
        <div style={{ maxWidth: CARD_H * 1.5 }}>
          <EnquireButton
            artistId={artistId}
            artistName={artistName}
            workTitle={img.caption}
          />
        </div>
      )}

      {isOwner && (
        <Link
          href="/onboarding"
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Edit in portfolio →
        </Link>
      )}
    </div>
  );
}
