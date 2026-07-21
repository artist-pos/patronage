"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, ExternalLink } from "lucide-react";
import type { ProjectUpdateWithArtist } from "@/types/database";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import { EditUpdateModal } from "@/components/projects/EditUpdateModal";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleString("en-NZ", { month: "short" });
  return `${hh}:${mm}, ${dd} ${mon}`;
}

/* Compact relative form for the footer row — "2d", "3h" — so it never
   competes with the artist name for space (see formatTimestamp above for
   the full form, still used in share payloads). */
function formatRelativeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

/* Three content voices so the feed is scannable by type:
   teal kicker = process (studio updates), black chip = finished work,
   outlined chip = editorial (articles). */
function TypeKicker({ u }: { u: ProjectUpdateWithArtist }) {
  if (u.embed_provider === "Patronage") {
    return (
      <span className="inline-block border border-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]">
        Article
      </span>
    );
  }
  if (u.update_tag === "complete") {
    return (
      <span className="inline-block bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
        New work
      </span>
    );
  }
  const label =
    u.content_type === "audio" ? "Audio"
    : u.content_type === "video" ? "Video"
    : u.content_type === "embed" ? "Embed"
    : u.update_tag === "milestone" ? "Milestone"
    : u.update_tag === "concept" ? "Concept"
    : "Studio update";
  return <span className="t-kicker">{label}</span>;
}

interface FeedCardProps {
  u: ProjectUpdateWithArtist;
  priority?: boolean;
  /** id of the signed-in user — enables the inline edit pencil on their own posts */
  currentUserId?: string;
  /** admins/owners can edit any post */
  isAdmin?: boolean;
}

/**
 * v2 pin vocabulary — containerless.
 * Image pins: edge-to-edge image, hover dims 0.85 + crisp #000 attribution bar.
 * All other types: white surface on the feed bg, teal mono kicker, footer
 * attribution row with a border-top divider. No borders, no radius, no shadow.
 */
export const FeedCard = memo(function FeedCard({ u, priority = false, currentUserId, isAdmin = false }: FeedCardProps) {
  const name = u.artist_full_name ?? u.artist_username;
  const canEdit = !!currentUserId && (u.artist_id === currentUserId || isAdmin);
  const href = u.project_id ? `/threads/${u.project_id}?scroll=${u.id}` : `/projects/${u.id}?from=feed`;

  const SITE_URL = "https://patronage.nz";
  const sharePayload = {
    type: "update" as const,
    title: u.title ?? u.caption?.slice(0, 60) ?? "Studio Update",
    sub: u.tldr ?? `${name} · ${formatTimestamp(u.created_at)}`,
    price: null,
    tag: "STUDIO UPDATE",
    handle: `@${u.artist_username}`,
    imageUrl: u.content_type === "image" ? u.image_url : null,
    shareUrl: `${SITE_URL}${href}`,
  };

  const controls = (
    <span className="flex shrink-0 items-center gap-0.5">
      {canEdit && (
        <EditUpdateModal
          updateId={u.id}
          contentType={u.content_type}
          initialTitle={u.title}
          initialTldr={u.tldr ?? null}
          initialCaption={u.caption ?? null}
          initialTextContent={u.text_content ?? null}
          variant="icon"
        />
      )}
      <ShareTrigger
        payload={sharePayload}
        variant="icon"
        className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
      />
    </span>
  );

  /* Footer attribution row for surface pins (text/audio/video/embed).
     Name gets flex-1 min-w-0 (effective priority — it truncates last, not
     the timestamp) and the timestamp is a short relative form with
     shrink-0, so a long name and a short "2d" never fight for space. */
  const attributionRow = (
    <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
        <Link
          href={`/${u.artist_username}`}
          className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </Link>
        <span className="shrink-0 font-mono text-[9px] text-[color:var(--fg-subtle)]">
          {formatRelativeShort(u.created_at)}
        </span>
      </div>
      {controls}
    </div>
  );

  /* ── IMAGE PINS ──
     Without caption: containerless — image edge-to-edge, hover attribution.
     With caption/title: white surface pin so the words are always visible
     (captions are content, not chrome — they must not hide behind hover). */
  if (u.content_type === "image" && u.image_url) {
    const hasAspect = u.image_width && u.image_height;
    const hasWords = !!(u.title || u.caption);

    if (!hasWords) {
      return (
        <div className="pin relative mb-2 break-inside-avoid">
          <Link href={href} scroll={false} className="block">
            <div
              className="overflow-hidden"
              style={hasAspect ? { aspectRatio: `${u.image_width} / ${u.image_height}` } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-pin-img
                src={u.image_url}
                alt={`Update by ${name}`}
                loading={priority ? "eager" : "lazy"}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
            <div data-pin-overlay>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">
                  {name}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-white/60">
                  {formatRelativeShort(u.created_at)}
                </span>
              </div>
            </div>
          </Link>
          {/* Controls — revealed on hover, top-right, over the image */}
          <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 bg-black/60 opacity-0 transition-opacity duration-200 [.pin:hover_&]:opacity-100 text-white">
            {controls}
          </div>
        </div>
      );
    }

    // Captioned studio update — image on a white surface, caption below
    return (
      <div className="mb-2 break-inside-avoid bg-card">
        <Link href={href} scroll={false} className="pin block">
          <div
            className="overflow-hidden"
            style={hasAspect ? { aspectRatio: `${u.image_width} / ${u.image_height}` } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-pin-img
              src={u.image_url}
              alt={u.caption ?? `Update by ${name}`}
              loading={priority ? "eager" : "lazy"}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <div className="px-4 pb-1 pt-3">
            <div className="mb-2">
              <TypeKicker u={u} />
            </div>
            {u.title && (
              <div className="mb-1 text-[15px] font-medium leading-[1.35]">{u.title}</div>
            )}
            {u.caption && (
              <p className="line-clamp-4 text-[13px] leading-[1.55] text-[color:var(--fg-muted)]">
                {u.caption}
              </p>
            )}
          </div>
        </Link>
        <div className="px-4 pb-4 pt-2">{attributionRow}</div>
      </div>
    );
  }

  /* ── SURFACE PINS — white on feed bg ── */

  const media = (() => {
    if (u.content_type === "audio") {
      return (
        <div className="mb-3.5">
          {u.audio_url && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              controls
              className="h-8 w-full"
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
          <div className="relative -mx-5 -mt-1 mb-3.5 aspect-video overflow-hidden bg-black">
            {/* Decorative play overlay — outer Link handles navigation. */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex h-11 w-11 items-center justify-center bg-black/70">
                <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
              </div>
            </div>
            <iframe
              src={u.embed_url}
              title={u.caption ?? `Video by ${name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className="pointer-events-none h-full w-full"
            />
          </div>
        );
      }
      if (u.video_url) {
        return (
          <div className="-mx-5 -mt-1 mb-3.5 bg-black" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video className="max-h-[300px] w-full" src={u.video_url} controls />
          </div>
        );
      }
      return (
        <div className="mb-3.5 flex min-h-[100px] items-center justify-center bg-foreground text-white">
          <Play className="h-8 w-8 opacity-40" />
        </div>
      );
    }

    if (u.content_type === "embed" && u.embed_url) {
      return (
        <div className="relative -mx-5 -mt-1 mb-3.5 overflow-hidden bg-muted">
          <Link href={href} className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex items-center gap-1.5 border border-border bg-background/90 px-3 py-1.5">
              <ExternalLink className="h-3 w-3" />
              <span className="font-mono text-[11px]">{u.embed_provider ?? "View embed"}</span>
            </div>
          </Link>
          <iframe
            src={u.embed_url}
            title={u.caption ?? `Embed by ${name}`}
            className="pointer-events-none w-full"
            style={{ height: 240 }}
          />
        </div>
      );
    }

    return null;
  })();

  const bodyText =
    u.content_type === "text"
      ? u.text_content
      : u.caption && u.content_type !== "embed"
        ? u.caption
        : null;

  return (
    <div className="mb-2 break-inside-avoid">
      <div className="flex flex-col bg-card p-5">
        <Link href={href} scroll={false} className="block">
          <div className="mb-3">
            <TypeKicker u={u} />
          </div>
          {media}
          {u.content_type !== "text" && (u.title || (u.content_type === "audio" && u.caption)) && (
            <div className="mb-1 text-[15px] font-medium leading-[1.35]">
              {u.title ?? u.caption}
            </div>
          )}
          {bodyText && (
            <p
              className={
                u.content_type === "text"
                  ? "mb-4 line-clamp-[8] text-[17px] leading-[1.62] tracking-[-0.01em]"
                  : "mb-3 line-clamp-3 text-[13px] leading-[1.55] text-[color:var(--fg-muted)]"
              }
            >
              {bodyText}
            </p>
          )}
          {u.embed_provider === "Patronage" && u.embed_url && (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(u.embed_url!, "_blank", "noopener,noreferrer"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); window.open(u.embed_url!, "_blank", "noopener,noreferrer"); } }}
              className="mb-3 block cursor-pointer font-mono text-[11px] text-[color:var(--fg-muted)] underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Read article →
            </span>
          )}
        </Link>
        {attributionRow}
      </div>
    </div>
  );
});
