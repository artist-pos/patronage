"use client";

import { useState, useRef, useEffect } from "react";
import { Music, Play, Type, ExternalLink } from "lucide-react";
import type { PortfolioImage } from "@/types/database";

interface Props {
  images: PortfolioImage[];
  username: string;
  viewerRole?: string | null;
  profileId?: string;
  limit?: number;
  isOwner?: boolean;
  rowH?: number;    // target row height in px
  gutter?: number;  // fixed gap between tiles in px
}

function getAR(img: PortfolioImage): number {
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

interface Tile { img: PortfolioImage; w: number; h: number; }
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
function buildRows(images: PortfolioImage[], containerW: number, targetH: number, gap: number): Row[] {
  if (containerW <= 0 || images.length === 0) return [];

  const rows: Row[] = [];
  let batch: PortfolioImage[] = [];
  let batchAR = 0;

  for (const img of images) {
    const ar = getAR(img);
    batch.push(img);
    batchAR += ar;

    const rowH = (containerW - (batch.length - 1) * gap) / batchAR;

    if (rowH <= targetH) {
      // Row is full — compute exact pixel widths
      const tiles: Tile[] = batch.map(i => ({
        img: i,
        w: Math.round(getAR(i) * rowH),
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
        w: Math.round(getAR(i) * targetH),
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
}: Props) {
  const displayed = limit ? images.slice(0, limit) : images;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.offsetWidth);
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = containerW !== null ? buildRows(displayed, containerW, rowH, gutter) : [];

  return (
    <div ref={containerRef}>
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: "flex",
            gap: gutter,
            marginBottom: ri < rows.length - 1 ? gutter : 0,
            justifyContent: row.isLast ? "center" : "flex-start",
          }}
        >
          {row.tiles.map(({ img, w, h }) => {
            const ct    = img.content_type ?? "image";
            const label = img.title
              ? `${img.title}${img.year ? ` (${img.year})` : ""}`
              : img.caption ?? undefined;

            return (
              <a
                key={img.id}
                href={`/${username}/works/${img.slug ?? img.id}`}
                aria-label={label ?? "View artwork"}
                style={{
                  width: w,
                  height: h,
                  flexShrink: 0,
                  position: "relative",
                  overflow: "hidden",
                  display: "block",
                  textDecoration: "none",
                }}
              >
                {/* Image / Document */}
                {(ct === "image" || ct === "document") && img.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={label ?? "Portfolio work"}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#FAFAF9" }}
                  />
                )}

                {/* Audio */}
                {ct === "audio" && (
                  <div style={{ position:"absolute",inset:0,background:"#1c1c1e",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"white" }}>
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.25 }} />
                    )}
                    <Music className="w-6 h-6" style={{ position:"relative" }} />
                    {label && <p style={{ position:"relative",fontSize:10,textAlign:"center",padding:"0 12px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{label}</p>}
                  </div>
                )}

                {/* Video */}
                {ct === "video" && (
                  <div style={{ position:"absolute",inset:0,background:"#1c1c1e",display:"flex",alignItems:"center",justifyContent:"center",color:"white" }}>
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.25 }} />
                    )}
                    <div style={{ position:"relative",width:40,height:40,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.8)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Text / Writing */}
                {ct === "text" && (
                  <div style={{ position:"absolute",inset:0,background:"#fafaf8",padding:16,display:"flex",flexDirection:"column",gap:8,overflow:"hidden" }}>
                    <Type className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    {img.text_content && (
                      <p style={{ fontFamily:"monospace",fontSize:11,lineHeight:1.6,color:"#57534e",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:10,WebkitBoxOrient:"vertical",whiteSpace:"pre-wrap" }}>
                        {img.text_content}
                      </p>
                    )}
                  </div>
                )}

                {/* Embed */}
                {ct === "embed" && (
                  <div style={{ position:"absolute",inset:0,background:"#1c1c1e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:"white" }}>
                    <ExternalLink className="w-5 h-5 opacity-60" />
                    <p style={{ fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em",color:"#a8a29e" }}>{img.embed_provider ?? "Embed"}</p>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}
