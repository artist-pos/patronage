"use client";

import { memo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Maximize2, ExternalLink } from "lucide-react";
import type { ProjectUpdateWithArtist } from "@/types/database";
import { EditUpdateModal } from "@/components/projects/EditUpdateModal";
import { AdminHideToggle } from "@/components/feed/AdminHideToggle";
import { SaveToBoard } from "@/components/boards/SaveToBoard";
import { AppreciateButton } from "@/components/feed/AppreciateButton";
import { EventRecordPrompt } from "@/components/feed/EventRecordPrompt";
import { gridImageSrc } from "@/lib/image";
import { LinkifiedText } from "@/components/ui/LinkifiedText";
import { eventDateParts, eventLine, formatEventTime, isEventPast } from "@/lib/events";

/* Minimal video pin — native `controls` brings the full browser control bar
   (scrubber, volume, PiP, cast, its own fullscreen button) which is both
   visually noisy in a masonry tile and the source of a real bug: clicks on
   the native controls' fullscreen button live in the browser's shadow DOM
   and don't reliably respect this card's stopPropagation, so they were
   bubbling up to the enclosing Link and navigating away mid-interaction.
   A plain, ordinary DOM button for play/fullscreen sidesteps both — only
   the two controls asked for, and every click is one we control. The
   container is sized to the video's own aspect ratio once metadata loads
   (rather than a fixed max-height) so there's no leftover box for the
   browser to letterbox into — that's what the black bars were. */
function InlineVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const togglePlay = (e: React.SyntheticEvent) => {
    stop(e);
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const goFullscreen = (e: React.SyntheticEvent) => {
    stop(e);
    videoRef.current?.requestFullscreen?.();
  };

  return (
    <div
      className="relative -mx-3.5 -mt-3.5 mb-3.5 bg-black sm:-mx-5 sm:-mt-5"
      style={ratio ? { aspectRatio: ratio } : undefined}
      onClick={stop}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        className="block h-full w-full"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
      />
      {/* Paused: a big centre triangle doubles as the whole click target.
          Playing: the target stays (click anywhere to pause) but shows
          nothing, so it doesn't sit on top of the video like a watermark. */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className="absolute inset-0 flex items-center justify-center"
      >
        {!playing && (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white transition-transform hover:scale-105">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={goFullscreen}
        aria-label="Fullscreen"
        className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* Compact relative form for the footer row — "2d", "3h". */
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

/* Only the kinds that stand out get a label. Plain process posts carry none:
   on a page of studio updates, "Studio update" on every card was noise. */
function TypeKicker({ u }: { u: ProjectUpdateWithArtist }) {
  if (u.embed_provider === "Patronage") {
    return <span className="tag">article</span>;
  }
  if (u.update_tag === "complete") {
    return <span className="pill-dark">NEW WORK</span>;
  }
  const label =
    u.update_tag === "milestone" ? "Milestone"
    : u.content_type === "audio" ? "Audio"
    : null;
  return label ? <span className="t-kicker">{label}</span> : null;
}

function hasKicker(u: ProjectUpdateWithArtist): boolean {
  return u.embed_provider === "Patronage" || u.update_tag === "complete" || u.update_tag === "milestone" || u.content_type === "audio";
}

/* Event date. A date box with day, time and venue from sm up; one mono line
   in a two-column phone feed, where the box squeezed the venue to four lines. */
function EventDate({ u }: { u: ProjectUpdateWithArtist }) {
  if (!u.event_date) return null;
  const p = eventDateParts(u.event_date);
  const past = isEventPast(u.event_date);
  const time = formatEventTime(u.event_time);
  return (
    <div className="mb-3">
      <p className={`font-mono text-[11px] uppercase tracking-[0.04em] sm:hidden ${past ? "text-[color:var(--fg-subtle)]" : "text-foreground"}`}>
        {past ? "Was " : ""}{eventLine(u.event_date, u.event_time)}
        {u.event_venue && <span className="block truncate normal-case tracking-normal text-[color:var(--fg-muted)]">{u.event_venue}</span>}
      </p>
      <div className="hidden items-stretch gap-3 sm:flex">
        <div className={`flex w-12 shrink-0 flex-col border text-center font-mono ${past ? "border-[color:var(--fg-subtle)] text-[color:var(--fg-subtle)]" : "border-foreground"}`}>
          <span className={`py-0.5 text-[9px] font-semibold tracking-[0.04em] text-white ${past ? "bg-[color:var(--fg-subtle)]" : "bg-black"}`}>{p.month}</span>
          <span className="flex flex-1 items-center justify-center py-1.5 text-xl font-semibold leading-none">{p.day}</span>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <span className={`text-[13px] ${past ? "text-[color:var(--fg-muted)]" : "font-medium"}`}>
            {past ? `Was on ${p.weekday} ${p.day}` : `${p.weekday}${time ? `, ${time}` : ""}`}
          </span>
          {u.event_venue && <span className="truncate font-mono text-[11px] text-[color:var(--fg-muted)]">{u.event_venue}</span>}
        </div>
      </div>
    </div>
  );
}

interface FeedCardProps {
  u: ProjectUpdateWithArtist;
  priority?: boolean;
  /** id of the signed-in user — enables the inline edit pencil on their own posts */
  currentUserId?: string;
  /** admins/owners can edit any post */
  isAdmin?: boolean;
  /** The viewer has appreciated this update (225) — their own mark only. */
  appreciated?: boolean;
  /** Private save total on the viewer's own update (224). Never shown to anyone else. */
  saves?: number;
}

/**
 * v2 pin vocabulary — containerless.
 * Image pins: edge-to-edge image (hover dims 0.85) over an always-visible name
 * strip. All other types: white surface on the feed bg, a kicker only for
 * kinds that stand out, and a footer with the name on its own line above the
 * date and actions. No borders, no radius, no shadow.
 */
export const FeedCard = memo(function FeedCard({ u, priority = false, currentUserId, isAdmin = false, appreciated = false, saves }: FeedCardProps) {
  const name = u.artist_full_name ?? u.artist_username;
  const canEdit = !!currentUserId && (u.artist_id === currentUserId || isAdmin);
  const isOwnPost = !!currentUserId && u.artist_id === currentUserId;
  const href = u.project_id ? `/threads/${u.project_id}?scroll=${u.id}` : `/projects/${u.id}?from=feed`;
  const isEvent = !!u.event_date;
  const askForRecord = isOwnPost && isEvent && isEventPast(u.event_date) && !u.event_cv_status;

  /* Heart and save only: share lives on the update's own page. Each button is
     28px to look at with a 40px tap area (the ::before), spaced so a thumb on a
     phone doesn't save when it meant to appreciate. */
  const renderControls = () => (
    <span className="-mr-1.5 flex shrink-0 items-center gap-2 [&_button]:relative [&_button]:before:absolute [&_button]:before:-inset-1.5 [&_button]:before:content-['']">
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
      {/* Admin-only moderation toggle — never rendered for the artist, so a
          moderated post looks completely unchanged from their side. */}
      {isAdmin && (
        <AdminHideToggle
          updateId={u.id}
          initialHidden={u.admin_hidden ?? false}
        />
      )}
      {!isOwnPost && (
        <AppreciateButton
          updateId={u.id}
          appreciated={appreciated}
          isAuthenticated={currentUserId ? true : undefined}
        />
      )}
      <SaveToBoard
        itemType="update"
        itemId={u.id}
        isAuthenticated={currentUserId ? true : undefined}
      />
    </span>
  );

  /* The artist's name has a line to itself, so on a 167px phone column the
     date and buttons can't squeeze it out. Date and actions share the row below. */
  const attributionRow = (
    <div className="mt-auto border-t border-border pt-2.5">
      <Link
        href={`/${u.artist_username}`}
        prefetch={false}
        className="block truncate text-[13px] font-medium text-foreground underline-offset-2 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {name}
      </Link>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
          {formatRelativeShort(u.created_at)}
        </span>
        {renderControls()}
      </div>
    </div>
  );

  /* Newest note, set apart below the attribution so it can't be read as the
     artist's words. A line, never a count (227). */
  const latestNote = u.latest_note && !u.notes_off ? (
    <Link
      href={u.project_id ? href : `/projects/${u.id}?from=feed#notes`}
      scroll={false}
      prefetch={false}
      className="mt-2.5 block bg-muted px-2.5 py-2 text-[12.5px] leading-[1.45] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
    >
      <span className="line-clamp-2">
        <span className="font-medium text-foreground">{u.latest_note.sender_name}</span> {u.latest_note.content}
      </span>
    </Link>
  ) : null;

  /* Private to the artist: saves on an upcoming event, then the one-tap CV
     question once the day has passed. */
  const ownEventPanel = isOwnPost && isEvent ? (
    askForRecord ? (
      <EventRecordPrompt updateId={u.id} saves={saves} />
    ) : !isEventPast(u.event_date) && saves ? (
      <p className="mt-2.5 font-mono text-[11px] text-[color:var(--fg-muted)]">
        Only you see this · {saves} {saves === 1 ? "save" : "saves"}
      </p>
    ) : null
  ) : null;

  /* ── IMAGE PINS ──
     Without caption: the image, then a thin strip with the name, heart and
     save, always visible. They used to appear on hover only, which left phone
     visitors with no artist and no actions at all.
     With caption/title: white surface pin so the words are always visible. */
  if (u.content_type === "image" && u.image_url) {
    const hasAspect = u.image_width && u.image_height;
    const hasWords = !!(u.title || u.caption);

    if (!hasWords && !isEvent) {
      return (
        <div className="pin relative mb-2 break-inside-avoid bg-card">
          <Link href={href} scroll={false} prefetch={false} className="block">
            <div
              className="overflow-hidden"
              style={hasAspect ? { aspectRatio: `${u.image_width} / ${u.image_height}` } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-pin-img
                src={gridImageSrc(u.image_url, u.thumb_url)}
                alt={`Update by ${name}`}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                decoding="async"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          </Link>
          <div className="flex items-center gap-2 py-1 pl-2.5 pr-2.5 sm:pl-3">
            <Link
              href={`/${u.artist_username}`}
              prefetch={false}
              className="min-w-0 flex-1 truncate text-[12px] font-medium underline-offset-2 hover:underline"
            >
              {name}
            </Link>
            {renderControls()}
          </div>
          {latestNote && <div className="px-2.5 pb-2.5 sm:px-3">{latestNote}</div>}
        </div>
      );
    }

    // Captioned studio update or event — image on a white surface, words below
    return (
      <div className="mb-2 break-inside-avoid bg-card">
        <Link href={href} scroll={false} prefetch={false} className="pin block">
          <div
            className="overflow-hidden"
            style={hasAspect ? { aspectRatio: `${u.image_width} / ${u.image_height}` } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-pin-img
              src={gridImageSrc(u.image_url, u.thumb_url)}
              alt={u.caption ?? `Update by ${name}`}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <div className="px-3.5 pb-1 pt-3 sm:px-4">
            {isEvent ? <EventDate u={u} /> : hasKicker(u) && <div className="mb-2"><TypeKicker u={u} /></div>}
            {u.title && (
              <div className="mb-1 text-[15px] font-medium leading-[1.35]">{u.title}</div>
            )}
            {u.caption && (
              <p className="line-clamp-4 text-[13px] leading-[1.55] text-[color:var(--fg-muted)]">
                <LinkifiedText text={u.caption} inert />
              </p>
            )}
          </div>
        </Link>
        <div className="px-3.5 pb-3.5 pt-2 sm:px-4 sm:pb-4">
          {ownEventPanel}
          {attributionRow}
          {latestNote}
        </div>
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
          <div className="relative -mx-3.5 -mt-1 mb-3.5 aspect-video overflow-hidden bg-black sm:-mx-5">
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
        return <InlineVideo src={u.video_url} />;
      }
      return (
        <div className="mb-3.5 flex min-h-[100px] items-center justify-center bg-foreground text-white">
          <Play className="h-8 w-8 opacity-40" />
        </div>
      );
    }

    if (u.content_type === "embed" && u.embed_url) {
      return (
        <div className="relative -mx-3.5 -mt-1 mb-3.5 overflow-hidden bg-muted sm:-mx-5">
          <Link href={href} prefetch={false} className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex items-center gap-1.5 border border-border bg-background/90 px-3 py-1.5">
              <ExternalLink className="h-3 w-3" />
              <span className="font-mono text-xs">{u.embed_provider ?? "View embed"}</span>
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
      <div className="flex flex-col bg-card p-3.5 sm:p-5">
        <Link href={href} scroll={false} prefetch={false} className="block">
          {u.content_type !== "video" && !isEvent && hasKicker(u) && (
            <div className="mb-3">
              <TypeKicker u={u} />
            </div>
          )}
          {media}
          {isEvent && <EventDate u={u} />}
          {u.content_type === "video" && !isEvent && hasKicker(u) && (
            <div className="mb-2">
              <TypeKicker u={u} />
            </div>
          )}
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
              <LinkifiedText text={bodyText} inert />
            </p>
          )}
          {u.embed_provider === "Patronage" && u.embed_url && (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(u.embed_url!, "_blank", "noopener,noreferrer"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); window.open(u.embed_url!, "_blank", "noopener,noreferrer"); } }}
              className="mb-3 block cursor-pointer font-mono text-xs text-[color:var(--fg-muted)] underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Read article →
            </span>
          )}
        </Link>
        {ownEventPanel}
        {attributionRow}
        {latestNote}
      </div>
    </div>
  );
});
