"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface FeaturedProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  imageUrl: string | null;
  imageUrl2: string | null;
  featuredProfile: FeaturedProfile | null;
  scheduledAt: string | null; // NZ local "YYYY-MM-DDTHH:mm" or null
  publishedAt: string | null; // UTC ISO or null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BlogPreviewModal({
  open,
  onClose,
  title,
  body,
  imageUrl,
  imageUrl2,
  featuredProfile,
  scheduledAt,
  publishedAt,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const displayDate = publishedAt ?? scheduledAt ?? new Date().toISOString();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-background w-full max-w-[1100px] my-6 mx-4 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-border bg-background/95 backdrop-blur-sm rounded-t-xl">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Preview · how this will look when published
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mirror of /blog/[slug] layout */}
        <div className="px-6 py-10 space-y-10">
          <article className="space-y-8 min-w-0 max-w-[820px] mx-auto">
            {imageUrl && (
              <div className="overflow-hidden">
                <div className="flex gap-2">
                  <img
                    src={imageUrl}
                    alt=""
                    className="flex-1 min-w-0 object-cover"
                    style={imageUrl2 ? { maxHeight: "480px" } : undefined}
                  />
                  {imageUrl2 && (
                    <img
                      src={imageUrl2}
                      alt=""
                      className="flex-1 min-w-0 object-cover"
                      style={{ maxHeight: "480px" }}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 max-w-[720px]">
              <h1 className="text-3xl font-semibold tracking-tight leading-tight">
                {title || "Untitled post"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formatDate(displayDate)}
                {scheduledAt && !publishedAt && (
                  <span className="ml-2 text-[11px] uppercase tracking-widest text-stone-400">
                    (scheduled)
                  </span>
                )}
              </p>
            </div>

            {featuredProfile && (
              <div className="flex items-center gap-4 max-w-[720px] p-4 border-[3px] border-black rounded-xl">
                {featuredProfile.avatar_url ? (
                  <Image
                    src={featuredProfile.avatar_url}
                    alt={featuredProfile.full_name ?? featuredProfile.username}
                    width={56}
                    height={56}
                    className="rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-stone-200 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
                    Featured Artist
                  </p>
                  <p className="text-sm font-semibold leading-snug">
                    {featuredProfile.full_name ?? featuredProfile.username}
                  </p>
                  {featuredProfile.bio && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {featuredProfile.bio}
                    </p>
                  )}
                </div>
              </div>
            )}

            {body && (
              <div
                className="
                  max-w-[720px]
                  text-sm leading-relaxed text-foreground
                  [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-8 [&_h1]:mb-3
                  [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-2
                  [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:mb-4
                  [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-4 [&_ul>li]:mb-1
                  [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-4 [&_ol>li]:mb-1
                  [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-70
                  [&_strong]:font-semibold
                  [&_em]:italic
                  [&_blockquote]:border-l-2 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-4
                  [&_hr]:border-stone-200 [&_hr]:my-8
                  [&_figure]:my-6
                  [&_figure_img]:block [&_figure_img]:w-full [&_figure_img]:h-auto
                  [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:leading-[1.55] [&_figcaption]:text-muted-foreground
                "
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
