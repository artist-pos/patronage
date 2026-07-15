"use client";

import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { saveAvailableWorksLayout } from "@/app/profile/gallery-actions";
import { formatPrice } from "@/lib/format-price";
import { ZoomableImage } from "@/components/ui/ZoomableImage";
import type { Artwork } from "@/types/database";

const WorkDetailActions = dynamic(
  () => import("@/components/profile/WorkDetailActions").then((m) => m.WorkDetailActions),
  { ssr: false }
);

const DEFAULT_ROW_H = 280;
const DEFAULT_GUTTER = 6;

interface Dims { w: number; h: number }

interface Tile { artwork: Artwork; w: number; h: number }
interface Row  { tiles: Tile[]; isLast: boolean }

function buildRows(
  artworks: Artwork[],
  dims: Record<string, Dims>,
  containerW: number,
  targetH: number,
  gap: number,
): Row[] {
  if (containerW <= 0 || artworks.length === 0) return [];

  const rows: Row[] = [];
  let batch: Artwork[] = [];
  let batchAR = 0;

  for (const art of artworks) {
    const d = dims[art.id];
    // Fallback: use physical mm dims if pixel dims not yet loaded
    const ar = d && d.h > 0
      ? d.w / d.h
      : (art.width_mm && art.height_mm && art.height_mm > 0)
        ? art.width_mm / art.height_mm
        : 1;

    batch.push(art);
    batchAR += ar;

    const rowH = (containerW - (batch.length - 1) * gap) / batchAR;
    if (rowH <= targetH) {
      const tiles: Tile[] = batch.map((a) => {
        const da = dims[a.id];
        const r = da && da.h > 0 ? da.w / da.h
          : (a.width_mm && a.height_mm && a.height_mm > 0) ? a.width_mm / a.height_mm : 1;
        return { artwork: a, w: Math.round(r * rowH), h: Math.round(rowH) };
      });
      const used = tiles.reduce((s, t) => s + t.w, 0) + (tiles.length - 1) * gap;
      tiles[tiles.length - 1].w += containerW - used;
      rows.push({ tiles, isLast: false });
      batch = [];
      batchAR = 0;
    }
  }

  if (batch.length > 0) {
    rows.push({
      tiles: batch.map((a) => {
        const da = dims[a.id];
        const r = da && da.h > 0 ? da.w / da.h
          : (a.width_mm && a.height_mm && a.height_mm > 0) ? a.width_mm / a.height_mm : 1;
        return { artwork: a, w: Math.round(r * targetH), h: targetH };
      }),
      isLast: true,
    });
  }

  return rows;
}

interface Props {
  artworks: Artwork[];
  artistId: string;
  artistName: string;
  isOwner: boolean;
  savedRowH?: number;
  savedGutter?: number;
}

export function ProfileAvailableGrid({
  artworks,
  artistId,
  artistName,
  isOwner,
  savedRowH,
  savedGutter,
}: Props) {
  const [rowH, setRowH] = useState(savedRowH ?? DEFAULT_ROW_H);
  const [gutter, setGutter] = useState(savedGutter ?? DEFAULT_GUTTER);
  const [dims, setDims] = useState<Record<string, Dims>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.offsetWidth);
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function handleLoad(id: string, e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w > 0 && h > 0) setDims((prev) => ({ ...prev, [id]: { w, h } }));
  }

  const rows = useMemo(
    () => containerW !== null ? buildRows(artworks, dims, containerW, rowH, gutter) : [],
    [artworks, dims, containerW, rowH, gutter],
  );

  function handleSave() {
    startTransition(async () => {
      await saveAvailableWorksLayout(rowH, gutter);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const lightboxArtwork = lightboxId ? artworks.find((a) => a.id === lightboxId) ?? null : null;

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxId) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setLightboxId(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxId]);

  return (
    <>
      {/* Slider controls — owner only */}
      {isOwner && (
        <div className="flex flex-wrap items-center gap-6 mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Row height: {rowH}px
            </label>
            <input
              type="range" min={120} max={500} step={10} value={rowH}
              onChange={(e) => setRowH(Number(e.target.value))}
              className="w-28 accent-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Spacing: {gutter}px
            </label>
            <input
              type="range" min={0} max={24} step={1} value={gutter}
              onChange={(e) => setGutter(Number(e.target.value))}
              className="w-24 accent-black"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="text-xs px-3 py-1.5 border border-black hover:bg-muted/40 transition-colors"
          >
            {saved ? "Saved" : "Save layout"}
          </button>
        </div>
      )}

      {/* Grid */}
      <div ref={containerRef}>
        {rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "flex",
              gap: gutter,
              marginBottom: ri < rows.length - 1 ? gutter : 0,
              justifyContent: row.isLast ? "flex-start" : "flex-start",
              alignItems: "flex-start",
            }}
          >
            {row.tiles.map(({ artwork, w, h }) => {
              const title = artwork.title ?? artwork.caption ?? "Untitled";
              const formattedPrice = !artwork.hide_price
                ? formatPrice(artwork.price_cents, artwork.price_currency, artwork.is_poa)
                : null;

              return (
                <div
                  key={artwork.id}
                  style={{ width: w, flexShrink: 0, minWidth: 0, cursor: "pointer" }}
                  onClick={() => setLightboxId(artwork.id)}
                >
                  <div
                    style={{
                      width: w,
                      height: h,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={artwork.url}
                      alt={title}
                      loading="lazy"
                      onLoad={(e) => handleLoad(artwork.id, e)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                        background: "#FAFAF9",
                      }}
                    />
                    {/* Price pill — always visible, bottom-right */}
                    {formattedPrice && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 6,
                          right: 6,
                          pointerEvents: "none",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            background: "rgba(255,255,255,0.92)",
                            color: "#1c1c1c",
                            fontSize: 10,
                            fontWeight: 500,
                            padding: "2px 7px",
                            borderRadius: 3,
                            lineHeight: 1.5,
                            backdropFilter: "blur(2px)",
                          }}
                        >
                          {formattedPrice}
                        </span>
                      </div>
                    )}
                    {artwork.is_poa && artwork.hide_price !== true && !formattedPrice && (
                      <div style={{ position: "absolute", bottom: 6, right: 6, pointerEvents: "none" }}>
                        <span style={{ display: "inline-block", background: "rgba(255,255,255,0.92)", color: "#1c1c1c", fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 3, lineHeight: 1.5 }}>
                          POA
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Caption below tile */}
                  {(artwork.title || artwork.year) && (
                    <div style={{ paddingTop: 5 }}>
                      {artwork.title && (
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#1c1c1c", margin: 0, lineHeight: 1.4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {artwork.title}
                        </p>
                      )}
                      {artwork.year && (
                        <p style={{ fontSize: 11, color: "#78716c", margin: 0, lineHeight: 1.4 }}>
                          {artwork.year}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxArtwork && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLightboxId(null)}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: 900,
              width: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
              <button onClick={() => setLightboxId(null)} className="text-stone-500 hover:text-stone-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Image — pinch / double-tap zoomable */}
              <ZoomableImage
                src={lightboxArtwork.url}
                alt={lightboxArtwork.title ?? lightboxArtwork.caption ?? ""}
                style={{ height: "60vh", background: "#FAFAF9" }}
              />

              {/* Details */}
              <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "#1c1c1c" }}>
                  {lightboxArtwork.title ?? lightboxArtwork.caption ?? "Untitled"}
                </h2>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {lightboxArtwork.year && (
                    <span style={{ fontSize: 13, color: "#78716c" }}>{lightboxArtwork.year}</span>
                  )}
                  {lightboxArtwork.medium && (
                    <span style={{ fontSize: 13, color: "#78716c" }}>{lightboxArtwork.medium}</span>
                  )}
                  {lightboxArtwork.dimensions && (
                    <span style={{ fontSize: 13, color: "#78716c" }}>{lightboxArtwork.dimensions}</span>
                  )}
                </div>
                {lightboxArtwork.description && (
                  <p style={{ fontSize: 13, color: "#57534e", margin: 0, lineHeight: 1.6 }}>
                    {lightboxArtwork.description}
                  </p>
                )}
                {!isOwner && (
                  <div style={{ marginTop: 8 }}>
                    <WorkDetailActions
                      artistId={artistId}
                      artistName={artistName}
                      artworkId={lightboxArtwork.id}
                      workTitle={lightboxArtwork.title ?? lightboxArtwork.caption}
                      workDescription={lightboxArtwork.description}
                      priceCents={lightboxArtwork.price_cents}
                      isPoa={lightboxArtwork.is_poa}
                      priceCurrency={lightboxArtwork.price_currency}
                      hidePrice={lightboxArtwork.hide_price}
                      listingMode={lightboxArtwork.listing_mode}
                      acquisitionMode={lightboxArtwork.acquisition_mode}
                      workImageUrl={lightboxArtwork.url}
                      year={lightboxArtwork.year}
                      medium={lightboxArtwork.medium}
                      dimensions={lightboxArtwork.dimensions}
                      edition={lightboxArtwork.edition}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
