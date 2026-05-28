"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import type { SeriesWork, SeriesEditionOption } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  series: {
    id: string;
    title: string;
    description: string | null;
  };
  artworks: (SeriesWork & { editions: SeriesEditionOption[] })[];
  artistName: string;
  artistUsername: string;
  isOwner: boolean;
  seriesId: string;
  seriesSlug: string;
}

export function SeriesDetailClient({ series, artworks, artistName, artistUsername, isOwner, seriesId, seriesSlug }: Props) {
  const [idx, setIdx] = useState(0);
  const current = artworks[idx];

  const prev = () => setIdx(i => (i - 1 + artworks.length) % artworks.length);
  const next = () => setIdx(i => (i + 1) % artworks.length);

  const metaLine = current
    ? [
        current.year ? String(current.year) : null,
        current.medium,
        current.dimensions,
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
        <Link href={`/${artistUsername}?tab=work`} className="hover:text-foreground transition-colors">
          ← {artistName}
        </Link>
        {isOwner && (
          <>
            <span className="text-border">·</span>
            <Link href={`/studio/series/${seriesId}`} className="hover:text-foreground transition-colors">
              Edit series
            </Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12 items-start">
        {/* Left — image viewer + thumbnail strip */}
        <div className="space-y-3">
          {/* Main image */}
          <div className="relative bg-stone-50 flex items-center justify-center" style={{ minHeight: 400 }}>
            {current?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={current.id}
                src={current.url}
                alt={current.title ?? current.caption ?? ""}
                className="w-full h-auto object-contain"
                style={{ maxHeight: 600 }}
              />
            ) : (
              <div className="w-full bg-stone-100" style={{ height: 400 }} />
            )}

            {artworks.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white border border-border transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white border border-border transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {artworks.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {artworks.map((aw, i) => (
                <button
                  key={aw.id}
                  onClick={() => setIdx(i)}
                  className={`shrink-0 w-[68px] h-[68px] overflow-hidden border-2 transition-colors ${
                    i === idx ? "border-black" : "border-transparent hover:border-stone-300"
                  }`}
                  aria-label={aw.title ?? aw.caption ?? `Work ${i + 1}`}
                >
                  {aw.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={aw.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-stone-200" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right — sticky metadata */}
        <div className="md:sticky md:top-6 space-y-6">
          {/* Series title + subtitle */}
          <div className="pb-5 border-b border-border space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
              Series — {artworks.length} {artworks.length === 1 ? "work" : "works"}
            </p>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold leading-snug">{series.title}</h1>
              <ShareTrigger
                variant="icon"
                payload={{
                  type: "work",
                  title: current?.title ?? current?.caption ?? series.title,
                  sub: series.title,
                  price: null,
                  tag: current?.medium ?? "",
                  handle: artistUsername,
                  imageUrl: current?.url ?? null,
                  shareUrl: `${SITE_URL}/${artistUsername}/series/${seriesSlug}`,
                }}
              />
            </div>
            {current && (current.title || current.caption) && (
              <p className="text-base text-muted-foreground font-normal">
                {current.title ?? current.caption}
              </p>
            )}
            {metaLine && (
              <p className="text-sm text-muted-foreground">{metaLine}</p>
            )}
          </div>

          {/* Medium tag */}
          {current?.medium && (
            <div>
              <span className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs">
                {current.medium}
              </span>
            </div>
          )}

          {/* Series description */}
          {series.description && (
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {series.description}
            </p>
          )}

          {/* Work index indicator */}
          {artworks.length > 1 && (
            <p className="text-xs text-stone-400">
              {idx + 1} / {artworks.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
