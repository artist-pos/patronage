"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Music, Play, Type, ExternalLink } from "lucide-react";
import type { ProjectUpdateWithArtist } from "@/types/database";

const FEED_H = 200;

export function StudioFeedCard({ u, className = "" }: { u: ProjectUpdateWithArtist; className?: string }) {
  const name = u.artist_full_name ?? u.artist_username;
  const href = u.project_id ? `/threads/${u.project_id}?scroll=${u.id}` : `/projects/${u.id}?from=feed`;

  const [cardWidth, setCardWidth] = useState<number | null>(() =>
    u.image_url && u.image_width && u.image_height
      ? Math.round(FEED_H * (u.image_width / u.image_height))
      : null
  );

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (cardWidth !== null) return;
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setCardWidth(Math.round(FEED_H * (img.naturalWidth / img.naturalHeight)));
    }
  }

  // Determine card width style based on content type
  const widthStyle: React.CSSProperties = (() => {
    if (u.content_type === "image" && u.image_url) {
      return cardWidth ? { width: cardWidth } : {};
    }
    // Fixed width for non-image types
    return { width: 280 };
  })();

  const mediaSection = (() => {
    if (u.content_type === "image" && u.image_url) {
      return (
        <div className="bg-muted" style={{ height: FEED_H }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u.image_url}
            alt={u.caption ?? `Update by ${name}`}
            loading="lazy"
            style={{ height: FEED_H, width: "auto", display: "block" }}
            onLoad={handleImgLoad}
          />
        </div>
      );
    }

    if (u.content_type === "video") {
      if (u.embed_url) {
        return (
          <div className="relative bg-black overflow-hidden" style={{ height: FEED_H }}>
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Play className="w-4 h-4 text-white fill-white ml-0.5" />
              </div>
            </div>
            <iframe
              src={u.embed_url}
              title={u.caption ?? `Video by ${name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className="w-full h-full pointer-events-none"
            />
          </div>
        );
      }
      if (u.video_url) {
        return (
          <div
            className="bg-black overflow-hidden flex items-center justify-center"
            style={{ height: FEED_H }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              className="w-full h-full object-cover"
              src={u.video_url}
              controls
            />
          </div>
        );
      }
      return (
        <div className="bg-zinc-900 text-white flex items-center justify-center" style={{ height: FEED_H }}>
          <Play className="w-8 h-8 opacity-30" />
        </div>
      );
    }

    if (u.content_type === "audio") {
      return (
        <div className="bg-zinc-900 text-white flex flex-col gap-3 p-4 justify-center" style={{ height: FEED_H }}>
          <Music className="w-5 h-5 opacity-40" />
          {u.audio_url && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              controls
              className="w-full h-8"
              src={u.audio_url}
              onClick={(e) => e.preventDefault()}
            />
          )}
          {u.embed_url && !u.audio_url && (
            <iframe
              src={u.embed_url}
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media"
              onClick={(e) => e.preventDefault()}
            />
          )}
        </div>
      );
    }

    if (u.content_type === "text" && u.text_content) {
      return (
        <div className="bg-background p-4 flex flex-col justify-start overflow-hidden" style={{ height: FEED_H }}>
          <Type className="w-4 h-4 text-muted-foreground mb-2 shrink-0 opacity-40" />
          <p className="text-sm leading-relaxed line-clamp-6 text-foreground">{u.text_content}</p>
        </div>
      );
    }

    if (u.content_type === "embed" && u.embed_url) {
      return (
        <div className="bg-muted relative overflow-hidden" style={{ height: FEED_H }}>
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5 flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3" />
              <span className="text-xs">{u.embed_provider ?? "View embed"}</span>
            </div>
          </div>
          <iframe
            src={u.embed_url}
            title={u.caption ?? `Embed by ${name}`}
            className="w-full pointer-events-none"
            style={{ height: FEED_H }}
          />
        </div>
      );
    }

    // Fallback: show image if present regardless of content_type mismatch
    if (u.image_url) {
      return (
        <div className="bg-muted" style={{ height: FEED_H }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u.image_url}
            alt={u.caption ?? `Update by ${name}`}
            loading="lazy"
            style={{ height: FEED_H, width: "auto", display: "block" }}
            onLoad={handleImgLoad}
          />
        </div>
      );
    }

    return null;
  })();

  const avatar = u.artist_avatar_url ? (
    <div className="relative w-5 h-5 shrink-0 overflow-hidden border border-black">
      <Image src={u.artist_avatar_url} alt={name} fill loading="lazy" className="object-cover" sizes="20px" />
    </div>
  ) : (
    <div className="w-5 h-5 shrink-0 border border-black bg-muted flex items-center justify-center text-[8px] font-semibold">
      {name.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div
      className={`group block sm:inline-block border border-border bg-background overflow-hidden ${className}`}
      style={widthStyle}
    >
      {/* Media links to the update; the artist attribution links to the public
          profile (/{username}) — not an internal studio route. */}
      <Link href={href} scroll={false} className="block">
        {mediaSection}
      </Link>
      <div className="px-2.5 py-1.5 border-t border-border">
        {u.artist_username ? (
          <Link href={`/${u.artist_username}`} className="flex items-center gap-1.5 min-w-0 group/artist">
            {avatar}
            <p className="text-xs font-semibold truncate flex-1 min-w-0 group-hover/artist:underline">{name}</p>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            {avatar}
            <p className="text-xs font-semibold truncate flex-1 min-w-0">{name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
