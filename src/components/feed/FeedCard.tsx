"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Music, Play, ExternalLink } from "lucide-react";
import type { ProjectUpdateWithArtist } from "@/types/database";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleString("en-NZ", { month: "short" });
  return `${hh}:${mm}, ${dd} ${mon}`;
}

interface FeedCardProps {
  u: ProjectUpdateWithArtist;
  priority?: boolean;
}

export const FeedCard = memo(function FeedCard({ u, priority = false }: FeedCardProps) {
  const name = u.artist_full_name ?? u.artist_username;
  const href = u.project_id ? `/threads/${u.project_id}` : `/projects/${u.id}?from=feed`;

  const mediaSection = (() => {
    if (u.content_type === "image" && u.image_url) {
      const hasAspect = u.image_width && u.image_height;
      return (
        <div
          className="overflow-hidden bg-muted"
          style={hasAspect ? { aspectRatio: `${u.image_width} / ${u.image_height}` } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u.image_url}
            alt={u.caption ?? `Update by ${name}`}
            loading={priority ? "eager" : "lazy"}
            style={{ width: "100%", height: "auto", display: "block" }}
            className="transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      );
    }

    if (u.content_type === "audio") {
      return (
        <div className="bg-zinc-900 text-white p-5 flex flex-col gap-3 min-h-[120px]">
          <Music className="w-6 h-6 opacity-50" />
          {u.discipline && (
            <span className="text-[9px] uppercase tracking-widest opacity-40">
              {u.discipline.replace(/_/g, " ")}
            </span>
          )}
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

    if (u.content_type === "video") {
      if (u.embed_url) {
        return (
          <div className="relative bg-black aspect-video overflow-hidden">
            <Link href={href} className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              </div>
            </Link>
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
          <div className="bg-black overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              className="w-full max-h-[300px]"
              src={u.video_url}
              onClick={(e) => e.preventDefault()}
              controls
            />
          </div>
        );
      }
      return (
        <div className="bg-zinc-900 text-white p-5 flex items-center justify-center min-h-[120px]">
          <Play className="w-8 h-8 opacity-40" />
        </div>
      );
    }

    if (u.content_type === "embed" && u.embed_url) {
      return (
        <div className="relative bg-muted overflow-hidden">
          <Link href={href} className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5 flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3" />
              <span className="text-xs">{u.embed_provider ?? "View embed"}</span>
            </div>
          </Link>
          <iframe
            src={u.embed_url}
            title={u.caption ?? `Embed by ${name}`}
            className="w-full pointer-events-none"
            style={{ height: 240 }}
          />
        </div>
      );
    }

    if (u.content_type === "text") {
      return (
        <div className="px-4 pt-4 bg-background">
          {u.discipline && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              {u.discipline.replace(/_/g, " ")}
            </p>
          )}
          {u.text_content && (
            <p className="text-sm leading-relaxed line-clamp-6">{u.text_content}</p>
          )}
        </div>
      );
    }

    return null;
  })();

  return (
    <Link
      href={href}
      scroll={false}
      className="group block break-inside-avoid mb-2 border border-border bg-background"
    >
      {mediaSection}

      <div className="px-2.5 py-2 space-y-1.5 border-t border-border">
        <div className="flex items-center gap-2">
          {u.artist_avatar_url ? (
            <div className="relative w-6 h-6 shrink-0 overflow-hidden border border-black">
              <Image
                src={u.artist_avatar_url}
                alt={name}
                fill
                className="object-cover"
                sizes="24px"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-6 h-6 shrink-0 border border-black bg-muted flex items-center justify-center text-[9px] font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate leading-tight">{name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight font-mono">
              {formatTimestamp(u.created_at)}
            </p>
          </div>
        </div>

        {u.caption && u.content_type !== "text" && (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-3">
            {u.caption}
          </p>
        )}
      </div>
    </Link>
  );
});
