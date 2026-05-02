"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Music, Play, Type, ExternalLink } from "lucide-react";
import type { PortfolioImage } from "@/types/database";
import { trackEvent } from "@/actions/trackEvent";
import { toggleFeaturedWork } from "@/app/profile/available-work-actions";

interface Props {
  img: PortfolioImage;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  artistName?: string;
  viewerRole?: string | null;
  profileId?: string;
  isOwner?: boolean;
  featuredCount?: number;
  onFeaturedToggle?: (id: string, featured: boolean) => void;
}

export function PortfolioDetailModal({ img, onClose, onPrev, onNext, hasPrev, hasNext, artistName, viewerRole, profileId, isOwner, featuredCount = 0, onFeaturedToggle }: Props) {
  const [featured, setFeatured] = useState(img.is_featured);
  const [toggling, setToggling] = useState(false);
  const [featErr, setFeatErr] = useState<string | null>(null);

  async function handleFeaturedToggle() {
    setToggling(true);
    setFeatErr(null);
    const next = !featured;
    const result = await toggleFeaturedWork(img.id, next, featuredCount);
    if (result.error) {
      setFeatErr(result.error);
    } else {
      setFeatured(next);
      onFeaturedToggle?.(img.id, next);
    }
    setToggling(false);
  }

  useEffect(() => {
    if (profileId) {
      trackEvent("artwork_view", { profile_id: profileId, artwork_id: img.id }).catch(() => {});
    }
  }, [img.id, profileId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (e.key === "ArrowRight" && hasNext) onNext?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const showCredit =
    artistName &&
    (viewerRole === "patron" || viewerRole === "partner");

  const ct = img.content_type ?? "image";

  // Lightbox mode: pure image with no sidebar content to show
  const isLightbox =
    (ct === "image" || ct === "document") &&
    !img.description &&
    !img.price &&
    !img.audio_url &&
    !img.video_url &&
    !img.embed_url &&
    !img.text_content &&
    !isOwner; // owners always get the sidebar (featured toggle)

  const label = img.title
    ? `${img.title}${img.year ? ` (${img.year})` : ""}`
    : img.caption ?? null;

  if (isLightbox) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-background border border-black hover:bg-muted transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Prev */}
        {hasPrev && (
          <button
            onClick={onPrev}
            aria-label="Previous artwork"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-background border border-black hover:bg-muted transition-colors z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Next */}
        {hasNext && (
          <button
            onClick={onNext}
            aria-label="Next artwork"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-background border border-black hover:bg-muted transition-colors z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Image */}
        <div className="relative max-w-5xl max-h-[88vh] w-full h-full flex items-center justify-center">
          {img.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.url}
              alt={label ?? "Artwork"}
              className="max-w-full max-h-[88vh] object-contain shadow-xl"
            />
          )}
          {/* Title overlay */}
          {label && (
            <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/40 to-transparent">
              <p className="text-white text-sm font-medium text-center drop-shadow">{label}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="
          w-full max-w-4xl h-[70vh] border border-black bg-background overflow-hidden
          grid grid-cols-1 [grid-template-rows:1fr_220px]
          sm:grid-cols-[1fr_260px] sm:[grid-template-rows:1fr]
        "
      >
        {/* ── Media panel ── */}
        <div className="relative overflow-hidden bg-muted group">

          {/* Audio */}
          {ct === "audio" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-900 text-white p-8">
              {img.url && (
                <div className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-cover opacity-30" />
                </div>
              )}
              <div className="relative flex flex-col items-center gap-4">
                <Music className="w-10 h-10 text-white/60" />
                {img.audio_url && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio controls src={img.audio_url} className="w-full max-w-xs" />
                )}
              </div>
            </div>
          )}

          {/* Video (uploaded file) */}
          {ct === "video" && img.video_url && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video controls src={img.video_url} className="max-w-full max-h-full" />
            </div>
          )}

          {/* Video (embed URL) or Embed */}
          {((ct === "video" && !img.video_url && img.embed_url) || ct === "embed") && img.embed_url && (
            <iframe
              src={img.embed_url}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              frameBorder="0"
              title={img.caption ?? "Embedded content"}
            />
          )}

          {/* Writing */}
          {ct === "text" && (
            <div className="absolute inset-0 overflow-y-auto p-8 bg-stone-50">
              <pre className="font-mono text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                {img.text_content}
              </pre>
            </div>
          )}

          {/* Embed with no URL */}
          {ct === "embed" && !img.embed_url && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-900 text-white">
              <ExternalLink className="w-8 h-8 text-white/60" />
              <p className="text-sm text-white/60">{img.embed_provider ?? "Embed"}</p>
            </div>
          )}

          {/* Image (default) */}
          {(ct === "image" || ct === "document") && img.url && (
            <Image
              src={img.url}
              alt={img.caption ?? "Portfolio work"}
              fill
              style={{ objectFit: "contain" }}
            />
          )}

          {/* Prev/Next arrows */}
          {hasPrev && (
            <button
              onClick={onPrev}
              aria-label="Previous artwork"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={onNext}
              aria-label="Next artwork"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── Text panel ── */}
        <div className="border-t border-black sm:border-t-0 sm:border-l flex flex-col overflow-hidden">
          <div className="flex justify-end shrink-0 border-b border-black">
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
            {ct !== "image" && ct !== "document" && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                {ct === "audio" && <Music className="w-3 h-3" />}
                {ct === "video" && <Play className="w-3 h-3" />}
                {ct === "text" && <Type className="w-3 h-3" />}
                {ct === "embed" && <ExternalLink className="w-3 h-3" />}
                {ct === "audio" ? "Audio" : ct === "video" ? "Video" : ct === "text" ? "Writing" : img.embed_provider ?? "Embed"}
              </p>
            )}
            {img.caption && (
              <p className="text-sm font-bold leading-snug">{img.caption}</p>
            )}
            {img.price && (
              <p className="text-xs text-muted-foreground">{img.price}</p>
            )}
            {img.description && (
              <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {img.description}
              </p>
            )}

            {isOwner && (
              <div className="pt-2 border-t border-border space-y-1">
                <button
                  onClick={handleFeaturedToggle}
                  disabled={toggling}
                  className={`text-xs px-2.5 py-1 border transition-colors disabled:opacity-40 ${
                    featured
                      ? "bg-black text-white border-black"
                      : "border-black hover:bg-muted/40"
                  }`}
                >
                  {featured ? "★ Featured" : "☆ Mark as Featured"}
                </button>
                {featErr && <p className="text-[11px] text-destructive">{featErr}</p>}
                <p className="text-[11px] text-muted-foreground">
                  Featured works appear on your profile overview — up to 8.
                </p>
              </div>
            )}
          </div>

          {showCredit && (
            <div className="shrink-0 px-5 py-4 border-t border-black">
              <p className="text-xs font-bold">{artistName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
