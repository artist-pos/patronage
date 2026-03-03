import { EnquireButton } from "./EnquireButton";
import type { PortfolioImage } from "@/types/database";

const CARD_H = 225;
const META_W = 200; // fixed width of the right-hand text column

interface Props {
  img: PortfolioImage;
  artistId: string;
  artistName: string;
  viewerRole: string | null;
  isOwner: boolean;
}

export function AvailableWorkCard({ img, artistId, artistName, viewerRole, isOwner }: Props) {
  const canEnquire = !isOwner && viewerRole !== null; // all authenticated non-owners

  return (
    <div
      className="flex-none flex flex-row border border-border bg-background snap-start"
      style={{ height: CARD_H, boxSizing: "border-box" }}
    >
      {/* Left: image — natural aspect ratio, fixed height */}
      <div className="overflow-hidden bg-muted flex-none" style={{ height: CARD_H }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Available work"}
          style={{ height: CARD_H, width: "auto", display: "block" }}
        />
      </div>

      {/* Right: metadata */}
      <div
        className="flex flex-col gap-2 p-4 border-l border-border"
        style={{ width: META_W }}
      >
        <div className="flex flex-col gap-1.5 flex-1 min-h-0">
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
              {img.description.slice(0, 280)}
            </p>
          )}
        </div>

        {/* Enquire button pinned to bottom */}
        {canEnquire && (
          <div className="mt-auto">
            <EnquireButton
              artistId={artistId}
              artistName={artistName}
              workTitle={img.caption}
              workDescription={img.description}
            />
          </div>
        )}
      </div>
    </div>
  );
}
