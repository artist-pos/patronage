"use client";

import { useState } from "react";
import Link from "next/link";
import { Music, Play, Type, ExternalLink } from "lucide-react";
import type { PortfolioImage } from "@/types/database";

interface Props {
  images: PortfolioImage[];
  username: string;
  viewerRole?: string | null;
  profileId?: string;
  limit?: number;
  isOwner?: boolean;
}

function PortfolioItem({ img, username }: { img: PortfolioImage; username: string }) {
  const [isLandscape, setIsLandscape] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    setIsLandscape(el.naturalWidth / el.naturalHeight > 1.2);
    setLoaded(true);
  }

  const label = img.title
    ? `${img.title}${img.year ? ` (${img.year})` : ""}`
    : img.caption ?? null;

  const href = `/${username}/works/${img.slug ?? img.id}`;
  const ct = img.content_type ?? "image";

  // ── Audio card ──────────────────────────────────────────────────────────────
  if (ct === "audio") {
    return (
      <Link href={href} className="flex flex-col gap-1.5 group md:shrink-0 md:w-fit">
        <div
          className="border border-border overflow-hidden md:h-[300px] flex items-center justify-center bg-stone-900 text-white"
          style={{ aspectRatio: img.url ? undefined : "1 / 1", minWidth: "160px" }}
        >
          {img.url ? (
            <div className="relative w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? ""} className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Music className="w-7 h-7" />
                {label && <p className="text-[10px] text-center px-3 line-clamp-2">{label}</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-6">
              <Music className="w-7 h-7" />
              {label && <p className="text-[10px] text-center px-2 line-clamp-2">{label}</p>}
            </div>
          )}
        </div>
        {label && !img.url && (
          <p className="text-xs text-neutral-600 leading-snug max-w-0 min-w-full break-words">{label}</p>
        )}
      </Link>
    );
  }

  // ── Video card ──────────────────────────────────────────────────────────────
  if (ct === "video") {
    return (
      <Link href={href} className="flex flex-col gap-1.5 group md:shrink-0 md:w-fit">
        <div
          className="border border-border overflow-hidden md:h-[300px] flex items-center justify-center bg-stone-900 text-white"
          style={{ minWidth: "200px" }}
        >
          <div className="flex flex-col items-center gap-2 p-6">
            <div className="w-10 h-10 rounded-full border border-white flex items-center justify-center">
              <Play className="w-4 h-4 ml-0.5" />
            </div>
            {label && <p className="text-[10px] text-center px-2 line-clamp-2">{label}</p>}
          </div>
        </div>
        {label && (
          <p className="text-xs text-neutral-600 leading-snug max-w-0 min-w-full break-words">{label}</p>
        )}
      </Link>
    );
  }

  // ── Writing card ────────────────────────────────────────────────────────────
  if (ct === "text") {
    const preview = img.text_content?.slice(0, 120) ?? "";
    return (
      <Link href={href} className="flex flex-col gap-1.5 group md:shrink-0 md:w-fit">
        <div
          className="border border-border overflow-hidden md:h-[300px] bg-stone-50 p-5 flex flex-col gap-3"
          style={{ minWidth: "200px", maxWidth: "280px" }}
        >
          <Type className="w-4 h-4 text-stone-400 shrink-0" />
          {preview && (
            <p className="text-[12px] font-mono leading-relaxed text-stone-600 line-clamp-[8] whitespace-pre-wrap">
              {preview}
              {(img.text_content?.length ?? 0) > 120 && "…"}
            </p>
          )}
          {label && (
            <p className="text-[11px] text-stone-400 mt-auto">{label}</p>
          )}
        </div>
      </Link>
    );
  }

  // ── Embed card ──────────────────────────────────────────────────────────────
  if (ct === "embed") {
    const provider = img.embed_provider ?? "Embed";
    return (
      <Link href={href} className="flex flex-col gap-1.5 group md:shrink-0 md:w-fit">
        <div
          className="border border-border overflow-hidden md:h-[300px] bg-stone-900 text-white flex flex-col items-center justify-center gap-3 p-6"
          style={{ minWidth: "200px" }}
        >
          <ExternalLink className="w-6 h-6" />
          <p className="text-[10px] uppercase tracking-widest text-stone-400">{provider}</p>
          {label && <p className="text-[11px] text-center px-2 line-clamp-2">{label}</p>}
        </div>
        {label && (
          <p className="text-xs text-neutral-600 leading-snug max-w-0 min-w-full break-words">{label}</p>
        )}
      </Link>
    );
  }

  // ── Image card (default) ────────────────────────────────────────────────────
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1.5 group ${isLandscape ? "col-span-2" : ""} md:shrink-0 md:w-fit`}
    >
      <div
        className={`border border-border overflow-hidden md:h-[300px] md:w-fit${!loaded ? " max-md:aspect-square" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Portfolio work"}
          loading="lazy"
          className="w-full h-auto max-md:object-cover md:h-full md:w-auto group-hover:opacity-90 transition-opacity block"
          onLoad={handleLoad}
        />
      </div>
      {label && (
        <p className="text-xs text-neutral-600 leading-snug max-w-0 min-w-full break-words">
          {label}
        </p>
      )}
    </Link>
  );
}

export function PortfolioGrid({ images, username, limit }: Props) {
  const displayed = limit ? images.slice(0, limit) : images;

  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-4">
      {displayed.map((img) => (
        <PortfolioItem
          key={img.id}
          img={img}
          username={username}
        />
      ))}
    </div>
  );
}
