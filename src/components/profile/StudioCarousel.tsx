"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ProjectUpdateWithArtist } from "@/types/database";

interface Props {
  updates: ProjectUpdateWithArtist[];
}

const ROW_SIZE = 8; // tiles visible in collapsed single-row mode

export function StudioCarousel({ updates }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (updates.length === 0) return null;

  return (
    <section className="space-y-4 border-t border-border pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Studio Updates
        </h2>
        {updates.length > ROW_SIZE && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {expanded ? "Show less" : `View all ${updates.length}`}
          </button>
        )}
      </div>

      {expanded ? (
        /* 2-row grid (wraps naturally) */
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
          {updates.map((u) => (
            <Tile key={u.id} u={u} sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw" />
          ))}
        </div>
      ) : (
        /* Single horizontal scroll row */
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {updates.slice(0, ROW_SIZE).map((u) => (
            <Tile key={u.id} u={u} sizes="128px" fixed />
          ))}
          {updates.length > ROW_SIZE && (
            <button
              onClick={() => setExpanded(true)}
              className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 border border-dashed border-black flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              +{updates.length - ROW_SIZE} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Tile({
  u,
  sizes,
  fixed,
}: {
  u: ProjectUpdateWithArtist;
  sizes: string;
  fixed?: boolean;
}) {
  return (
    <Link
      href={`/projects/${u.id}`}
      className={`group relative border border-border overflow-hidden bg-muted block aspect-square${fixed ? " w-28 sm:w-32 shrink-0" : ""}`}
    >
      <Image
        src={u.image_url}
        alt={u.caption ?? "Studio update"}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes={sizes}
      />
      {u.caption && (
        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
          <p className="text-xs line-clamp-2 leading-snug">{u.caption}</p>
        </div>
      )}
    </Link>
  );
}
