"use client";

import { useState } from "react";
import { SaveButton } from "./SaveButton";

// ── Luminance detection ────────────────────────────────────────────────────────
// Samples the four corners of the image (20px inset) via a hidden canvas.
// Transparent pixels are composited against #FAFAF9 (250, 250, 249) — the
// page background — before calculating perceived luminance.
// Returns true if the image reads as dark (needs a light/white background).
// Falls back silently on CORS errors.

function detectIsDark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): boolean {
  const s = Math.min(20, Math.floor(Math.min(w, h) / 4)); // corner sample size
  const regions = [
    { x: 0,     y: 0     },
    { x: w - s, y: 0     },
    { x: 0,     y: h - s },
    { x: w - s, y: h - s },
  ];

  let total = 0;
  let count = 0;

  for (const { x, y } of regions) {
    const { data } = ctx.getImageData(x, y, s, s);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      // Composite against #FAFAF9
      const r = data[i]     * a + 250 * (1 - a);
      const g = data[i + 1] * a + 250 * (1 - a);
      const b = data[i + 2] * a + 249 * (1 - a);
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }

  return count > 0 && total / count < 128;
}

function sampleLuminance(src: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        resolve(detectIsDark(ctx, canvas.width, canvas.height));
      } catch {
        // Canvas tainted (CORS) — fall back
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  imageUrl: string | null;
  alt: string;
  type: string;
  priority?: boolean;
  fundingLabel?: string | null;
  preOpen?: boolean;
  closing?: boolean;
  urgent?: boolean;
  isPreview?: boolean;
  opportunityId?: string;
  initialSaved?: boolean;
  isAuthenticated?: boolean;
}

export function OpportunityImageArea({
  imageUrl,
  alt,
  type,
  priority = false,
  fundingLabel,
  preOpen = false,
  closing = false,
  urgent = false,
  isPreview = false,
  opportunityId,
  initialSaved = false,
  isAuthenticated = false,
}: Props) {
  // null = not yet sampled; true = dark image (white bg); false = light image (grey bg)
  const [isDark, setIsDark] = useState<boolean | null>(null);

  const bgColor = isDark === true ? "#ffffff" : "#f5f5f5";

  async function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (isDark !== null) return; // already sampled
    const src = (e.currentTarget as HTMLImageElement).src;
    const result = await sampleLuminance(src);
    if (result !== null) setIsDark(result);
  }

  return (
    <div
      className="relative shrink-0 w-24 md:w-full md:h-[200px] overflow-hidden border-r border-black md:border-r-0 md:border-b"
      style={{ backgroundColor: bgColor }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          onLoad={handleImgLoad}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "contain", objectPosition: "center", display: "block" }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-muted-foreground uppercase tracking-widest text-center px-1">
          {type}
        </span>
      )}

      {/* Overlays — desktop only */}
      {fundingLabel && (
        <div className="hidden md:block absolute top-0 right-0 bg-black text-white font-mono font-bold text-sm px-3 py-1.5 leading-none">
          {fundingLabel}
        </div>
      )}
      {preOpen ? (
        <div className="hidden md:block absolute top-2 left-2 z-10 bg-white text-black border border-black font-mono text-xs px-3 py-1 leading-none">
          Not yet open
        </div>
      ) : closing && (
        <div className={`hidden md:block absolute top-2 left-2 z-10 font-mono text-xs px-3 py-1 leading-none ${urgent ? "bg-red-600 text-white" : "bg-black text-white"}`}>
          {urgent ? "Closes today" : "Closing soon"}
        </div>
      )}

      {/* Save button */}
      {!isPreview && opportunityId && (
        <div className="hidden md:block absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1" onClick={(e) => e.preventDefault()}>
          <SaveButton
            opportunityId={opportunityId}
            initialSaved={initialSaved}
            isAuthenticated={isAuthenticated}
          />
        </div>
      )}
    </div>
  );
}
