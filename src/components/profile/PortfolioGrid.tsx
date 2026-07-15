"use client";

import { useState, useRef, useEffect } from "react";
import { Music, Play, Type, ExternalLink } from "lucide-react";
import { gridImageSrc } from "@/lib/image";
import type { PortfolioImage } from "@/types/database";

export interface GridSeriesItem {
  _kind: "series";
  id: string;
  title: string;
  slug: string;
  hero_image_url: string | null;
  artworkCount: number;
  is_featured: boolean;
  position?: number;
  year?: number;
}

export type GridItem = PortfolioImage | GridSeriesItem;

function isSeries(item: GridItem): item is GridSeriesItem {
  return "_kind" in item && item._kind === "series";
}

interface Props {
  images: GridItem[];
  username: string;
  viewerRole?: string | null;
  profileId?: string;
  limit?: number;
  isOwner?: boolean;
  rowH?: number;
  gutter?: number;
  lastRowAlign?: "left" | "center" | "right";
}

function getAR(item: GridItem, detectedARs?: Record<string, number>): number {
  if (isSeries(item)) return 3 / 2;
  const img = item as PortfolioImage;
  if (detectedARs?.[img.id]) return detectedARs[img.id];
  if (img.natural_width && img.natural_height && img.natural_height > 0) {
    return img.natural_width / img.natural_height;
  }
  switch (img.content_type) {
    case "video":
    case "embed":
      return 16 / 9;
    case "text":
      return 3 / 4;
    default:
      return 1;
  }
}

interface Tile { img: GridItem; w: number; h: number; }
interface Row  { tiles: Tile[]; isLast: boolean; }

/**
 * Flickr-style row packing.
 *
 * For each full row:
 *   rowHeight = (containerW − (n−1) × gap) / Σ(AR_i)
 *   tileWidth = AR_i × rowHeight
 *
 * Since tileWidth/rowHeight == AR_i (the image's natural ratio), tiles have the
 * exact same aspect ratio as the source image — objectFit:cover fills with zero
 * cropping and zero whitespace. The last tile in each full row is pixel-adjusted
 * to absorb sub-pixel rounding so the row is perfectly flush edge-to-edge.
 *
 * The incomplete last row uses targetH and is centred.
 */
function buildRows(images: GridItem[], containerW: number, targetH: number, gap: number, detectedARs: Record<string, number>): Row[] {
  if (containerW <= 0 || images.length === 0) return [];

  const rows: Row[] = [];
  let batch: GridItem[] = [];
  let batchAR = 0;

  for (const img of images) {
    const ar = getAR(img, detectedARs);
    batch.push(img);
    batchAR += ar;

    const rowH = (containerW - (batch.length - 1) * gap) / batchAR;

    if (rowH <= targetH) {
      // Row is full — compute exact pixel widths
      const tiles: Tile[] = batch.map(i => ({
        img: i,
        w: Math.round(getAR(i, detectedARs) * rowH),
        h: Math.round(rowH),
      }));
      // Absorb rounding error in the last tile so the row is exactly containerW
      const used = tiles.reduce((s, t) => s + t.w, 0) + (tiles.length - 1) * gap;
      tiles[tiles.length - 1].w += containerW - used;

      rows.push({ tiles, isLast: false });
      batch = [];
      batchAR = 0;
    }
  }

  // Incomplete last row — fixed targetH, will be centred
  if (batch.length > 0) {
    rows.push({
      tiles: batch.map(i => ({
        img: i,
        w: Math.round(getAR(i, detectedARs) * targetH),
        h: targetH,
      })),
      isLast: true,
    });
  }

  return rows;
}

export function PortfolioGrid({
  images,
  username,
  limit,
  rowH = 280,
  gutter = 6,
  lastRowAlign = "left",
}: Props) {
  const displayed = limit ? images.slice(0, limit) : images;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number | null>(null);
  const [detectedARs, setDetectedARs] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const item of images) {
      if (!isSeries(item)) {
        const img = item as PortfolioImage;
        if (img.natural_width && img.natural_height && img.natural_height > 0) {
          init[img.id] = img.natural_width / img.natural_height;
        }
      }
    }
    return init;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.offsetWidth);
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function handleImageLoad(id: string, e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      const ar = naturalWidth / naturalHeight;
      setDetectedARs(prev => {
        if (Math.abs((prev[id] ?? 0) - ar) < 0.01) return prev;
        return { ...prev, [id]: ar };
      });
    }
  }

  const rows = containerW !== null ? buildRows(displayed, containerW, rowH, gutter, detectedARs) : [];

  return (
    <div ref={containerRef}>
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: "flex",
            gap: gutter,
            marginBottom: ri < rows.length - 1 ? gutter : 0,
            justifyContent: row.isLast
              ? lastRowAlign === "center" ? "center" : lastRowAlign === "right" ? "flex-end" : "flex-start"
              : "flex-start",
            alignItems: "flex-start",
          }}
        >
          {row.tiles.map(({ img, w, h }) => {
            if (isSeries(img)) {
              return (
                <div key={img.id} style={{ width: w, flexShrink: 0, minWidth: 0 }}>
                  <a
                    href={`/${username}/series/${img.slug}`}
                    aria-label={img.title}
                    style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "block", textDecoration: "none" }}
                  >
                    {img.hero_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={gridImageSrc(img.hero_image_url, null)}
                        alt={img.title}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#e7e5e4" }} />
                    )}
                  </a>
                  <div style={{ paddingTop: 5, overflow: "hidden", width: "100%" }}>
                    <p style={{ fontSize:12,fontWeight:500,color:"#1c1c1c",lineHeight:1.4,margin:0,wordBreak:"break-word" }}>
                      {img.title}
                    </p>
                    <p style={{ fontSize:11,color:"#78716c",lineHeight:1.4,margin:0 }}>
                      {img.year ? `${img.year} · ` : ""}{img.artworkCount} {img.artworkCount === 1 ? "work" : "works"}
                    </p>
                  </div>
                </div>
              );
            }

            const artwork = img as PortfolioImage;
            const ct    = artwork.content_type ?? "image";
            const label = artwork.title
              ? `${artwork.title}${artwork.year ? ` (${artwork.year})` : ""}`
              : artwork.caption ?? undefined;
            const hasCaption = !!(artwork.title || artwork.year);

            return (
              <div key={artwork.id} style={{ width: w, flexShrink: 0, minWidth: 0 }}>
              <a
                href={`/${username}/works/${artwork.slug ?? artwork.id}`}
                aria-label={label ?? "View artwork"}
                style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "block", textDecoration: "none" }}
              >
                {(ct === "image" || ct === "document") && artwork.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gridImageSrc(artwork.url, artwork.thumb_url)}
                    alt={label ?? "Portfolio work"}
                    loading="lazy"
                    onLoad={(e) => handleImageLoad(artwork.id, e)}
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#FAFAF9" }}
                  />
                )}
                {ct === "audio" && (
                  <div style={{ position:"absolute",inset:0,background:"#1c1c1e",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"white" }}>
                    {artwork.url && <img src={artwork.url} alt="" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.25 }} />} {/* eslint-disable-line @next/next/no-img-element */}
                    <Music className="w-6 h-6" style={{ position:"relative" }} />
                    {label && <p style={{ position:"relative",fontSize:10,textAlign:"center",padding:"0 12px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{label}</p>}
                  </div>
                )}
                {ct === "video" && (
                  <div style={{ position:"absolute",inset:0,background:"#1c1c1e",display:"flex",alignItems:"center",justifyContent:"center",color:"white" }}>
                    {artwork.url && <img src={artwork.url} alt="" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.25 }} />} {/* eslint-disable-line @next/next/no-img-element */}
                    <div style={{ position:"relative",width:40,height:40,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.8)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                  </div>
                )}
                {ct === "text" && (
                  <div style={{ position:"absolute",inset:0,background:"#fafaf8",padding:16,display:"flex",flexDirection:"column",gap:8,overflow:"hidden" }}>
                    <Type className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    {artwork.text_content && (
                      <p style={{ fontFamily:"monospace",fontSize:11,lineHeight:1.6,color:"#57534e",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:10,WebkitBoxOrient:"vertical",whiteSpace:"pre-wrap" }}>
                        {artwork.text_content}
                      </p>
                    )}
                  </div>
                )}
                {ct === "embed" && (
                  <div style={{ position:"absolute",inset:0,background:"#1c1c1e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:"white" }}>
                    <ExternalLink className="w-5 h-5 opacity-60" />
                    <p style={{ fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em",color:"#a8a29e" }}>{artwork.embed_provider ?? "Embed"}</p>
                  </div>
                )}
                {artwork.is_available && (
                  <span style={{ position:"absolute",top:8,left:8,fontFamily:"var(--font-geist-mono), monospace",fontSize:9,fontWeight:600,padding:"3px 7px",background:"#000",color:"white",letterSpacing:"0.06em",textTransform:"uppercase" }}>
                    Available
                  </span>
                )}
              </a>
              {hasCaption && (
                <div style={{ paddingTop: 5, overflow: "hidden", width: "100%" }}>
                  {artwork.title && (
                    <p style={{ fontSize:12,fontWeight:500,color:"#1c1c1c",lineHeight:1.4,margin:0,wordBreak:"break-word" }}>
                      {artwork.title}
                    </p>
                  )}
                  {artwork.year && (
                    <p style={{ fontSize:11,color:"#78716c",lineHeight:1.4,margin:0 }}>
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
  );
}
