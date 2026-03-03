import { EnquireButton } from "./EnquireButton";
import type { PortfolioImage } from "@/types/database";

const CARD_H = 225;
const MAX_W = CARD_H * 1.6; // cap card width for very wide images

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
    <div className="flex-none flex flex-col gap-1.5" style={{ maxWidth: MAX_W }}>
      {/* Image */}
      <div
        className="border border-border overflow-hidden bg-muted"
        style={{ height: CARD_H, width: "fit-content", maxWidth: MAX_W }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Available work"}
          style={{ height: CARD_H, width: "auto", display: "block", maxWidth: MAX_W }}
        />
      </div>

      {/* Work name */}
      {img.caption && (
        <p className="text-sm font-semibold leading-snug" style={{ maxWidth: MAX_W }}>
          {img.caption}
        </p>
      )}

      {/* Price */}
      {img.price && (
        <p className="text-xs text-muted-foreground">{img.price}</p>
      )}

      {/* Description — short preview */}
      {img.description && (
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2" style={{ maxWidth: MAX_W }}>
          {img.description}
        </p>
      )}

      {/* Patron enquiry action */}
      {canEnquire && (
        <div style={{ maxWidth: MAX_W }}>
          <EnquireButton
            artistId={artistId}
            artistName={artistName}
            workTitle={img.caption}
            workDescription={img.description}
          />
        </div>
      )}
    </div>
  );
}
