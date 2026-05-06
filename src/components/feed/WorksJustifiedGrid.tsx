"use client";

import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { saveWorksLayout } from "@/app/feed/works-layout-actions";
import { formatPrice } from "@/lib/format-price";

export interface ArtworkForGrid {
  id: string;
  url: string;
  title: string | null;
  caption: string | null;
  price_cents: number | null;
  is_poa: boolean;
  price_currency: "NZD" | "AUD";
  medium: string | null;
  hide_price: boolean;
  profile: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface Props {
  artworks: ArtworkForGrid[];
  isAdmin?: boolean;
  initialRowH?: number;
  initialHGap?: number;
  initialVGap?: number;
}

const DEFAULT_ROW_H = 300;
const DEFAULT_H_GAP = 4;
const DEFAULT_V_GAP = 12;

interface Tile { artwork: ArtworkForGrid; w: number; h: number }
interface Row  { tiles: Tile[]; isLast: boolean }

function buildRows(
  artworks: ArtworkForGrid[],
  dims: Record<string, { w: number; h: number }>,
  containerW: number,
  targetH: number,
  hGap: number,
): Row[] {
  if (containerW <= 0 || artworks.length === 0) return [];

  const rows: Row[] = [];
  let batch: ArtworkForGrid[] = [];
  let batchAR = 0;

  for (const art of artworks) {
    const d = dims[art.id];
    const ar = d && d.h > 0 ? d.w / d.h : 1;
    batch.push(art);
    batchAR += ar;

    const rowH = (containerW - (batch.length - 1) * hGap) / batchAR;

    if (rowH <= targetH) {
      const tiles: Tile[] = batch.map((a) => {
        const da = dims[a.id];
        const r = da && da.h > 0 ? da.w / da.h : 1;
        return { artwork: a, w: Math.round(r * rowH), h: Math.round(rowH) };
      });
      const used = tiles.reduce((s, t) => s + t.w, 0) + (tiles.length - 1) * hGap;
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
        const r = da && da.h > 0 ? da.w / da.h : 1;
        return { artwork: a, w: Math.round(r * targetH), h: targetH };
      }),
      isLast: true,
    });
  }

  return rows;
}


export function WorksJustifiedGrid({ artworks, isAdmin, initialRowH, initialHGap, initialVGap }: Props) {
  const [rowH, setRowH] = useState(initialRowH ?? DEFAULT_ROW_H);
  const [hGap, setHGap] = useState(initialHGap ?? DEFAULT_H_GAP);
  const [vGap, setVGap] = useState(initialVGap ?? DEFAULT_V_GAP);
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
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
    () => (containerW !== null ? buildRows(artworks, dims, containerW, rowH, hGap) : []),
    [artworks, dims, containerW, rowH, hGap],
  );

  function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    startTransition(async () => {
      const result = await saveWorksLayout(rowH, hGap, vGap);
      if (result?.error) {
        setSaveState("error");
        setSaveError(result.error);
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    });
  }

  if (artworks.length === 0) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        No works available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-6 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Row height: {rowH}px
            </label>
            <input
              type="range" min={120} max={600} step={10} value={rowH}
              onChange={(e) => setRowH(Number(e.target.value))}
              className="w-28 accent-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              H-gap: {hGap}px
            </label>
            <input
              type="range" min={0} max={32} step={1} value={hGap}
              onChange={(e) => setHGap(Number(e.target.value))}
              className="w-20 accent-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              V-gap: {vGap}px
            </label>
            <input
              type="range" min={0} max={48} step={2} value={vGap}
              onChange={(e) => setVGap(Number(e.target.value))}
              className="w-20 accent-black"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="text-xs px-3 py-1.5 border border-black hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Save layout"}
            </button>
            {saveState === "error" && saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
          </div>
        </div>
      )}

      <div ref={containerRef}>
        {rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "flex",
              gap: hGap,
              marginBottom: ri < rows.length - 1 ? vGap : 0,
              justifyContent: "flex-start",
              alignItems: "flex-start",
            }}
          >
            {row.tiles.map(({ artwork, w, h }) => {
              const displayName = artwork.profile?.full_name ?? artwork.profile?.username ?? "";
              const title = artwork.title ?? artwork.caption ?? "Untitled";
              const profileHref = artwork.profile ? `/${artwork.profile.username}` : "#";
              const workHref = artwork.profile ? `/${artwork.profile.username}?tab=work#artwork-${artwork.id}` : "#";

              return (
                <div key={artwork.id} style={{ width: w, flexShrink: 0, minWidth: 0 }}>
                  <Link href={workHref} style={{ display: "block", width: w, height: h, overflow: "hidden", position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={artwork.url}
                      alt={title}
                      loading="lazy"
                      onLoad={(e) => handleLoad(artwork.id, e)}
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#FAFAF9" }}
                    />
                  </Link>

                  <div style={{ paddingTop: 6, width: w, overflow: "hidden" }}>
                    <Link
                      href={workHref}
                      style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#1c1c1c", lineHeight: 1.4, marginBottom: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textDecoration: "none" }}
                    >
                      {title}
                    </Link>

                    <Link
                      href={profileHref}
                      style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none", marginBottom: 2 }}
                    >
                      {artwork.profile?.avatar_url ? (
                        <div style={{ position: "relative", width: 16, height: 16, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                          <Image src={artwork.profile.avatar_url} alt={displayName} fill className="object-cover" sizes="16px" />
                        </div>
                      ) : displayName ? (
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#e7e5e4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#78716c", flexShrink: 0, fontWeight: 500 }}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      ) : null}
                      <span style={{ fontSize: 11, color: "#78716c", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {displayName}
                      </span>
                    </Link>

                    {artwork.medium && (
                      <p style={{ fontSize: 11, color: "#a8a29e", margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {artwork.medium}
                      </p>
                    )}

                    {!artwork.hide_price && (formatPrice(artwork.price_cents, artwork.price_currency, artwork.is_poa)) && (
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#1c1c1c", marginTop: 2 }}>
                        {formatPrice(artwork.price_cents, artwork.price_currency, artwork.is_poa)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
