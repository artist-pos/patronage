"use client";

import { useState } from "react";
import Link from "next/link";
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

  return (
    <Link
      href={`/${username}/works/${img.slug ?? img.id}`}
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
      {img.caption && (
        <p className="text-xs text-muted-foreground leading-snug font-mono max-w-0 min-w-full break-words">
          {img.caption}
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
