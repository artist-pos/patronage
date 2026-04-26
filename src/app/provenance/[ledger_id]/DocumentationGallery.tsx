"use client";

import { useEffect, useState } from "react";
import { DOC_PHOTO_TYPES, type DocPhotoType } from "@/lib/artwork-documentation";

interface Photo {
  id: string;
  type: DocPhotoType;
  signedUrl: string | null;
  caption: string | null;
}

interface Props {
  photos: Photo[];
}

const TYPE_LABEL: Record<DocPhotoType, string> = Object.fromEntries(
  DOC_PHOTO_TYPES.map(t => [t.id, t.label]),
) as Record<DocPhotoType, string>;

export function DocumentationGallery({ photos }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (activeIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveIdx(null);
      if (e.key === "ArrowLeft") setActiveIdx(i => (i === null ? null : Math.max(0, i - 1)));
      if (e.key === "ArrowRight") setActiveIdx(i => (i === null ? null : Math.min(photos.length - 1, i + 1)));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, photos.length]);

  if (photos.length === 0) return null;

  const active = activeIdx === null ? null : photos[activeIdx];

  return (
    <section className="mb-12">
      <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-5">
        Documentation
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveIdx(i)}
            className="group text-left"
          >
            <div className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200 group-hover:border-stone-400 transition-colors">
              {p.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.signedUrl}
                  alt={p.caption ?? TYPE_LABEL[p.type]}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-stone-400">
                  Unavailable
                </div>
              )}
            </div>
            <p className="mt-1.5 text-[11px] uppercase tracking-wider text-stone-400 group-hover:text-stone-700 transition-colors">
              {TYPE_LABEL[p.type]}
            </p>
            {p.caption && (
              <p className="text-xs text-stone-500 truncate">{p.caption}</p>
            )}
          </button>
        ))}
      </div>

      {active && active.signedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setActiveIdx(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setActiveIdx(null)}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
          >
            <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {activeIdx! > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx! - 1); }}
              aria-label="Previous"
              className="absolute left-2 sm:left-6 p-2 text-white/70 hover:text-white"
            >
              <svg className="w-7 h-7" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {activeIdx! < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveIdx(activeIdx! + 1); }}
              aria-label="Next"
              className="absolute right-2 sm:right-6 p-2 text-white/70 hover:text-white"
            >
              <svg className="w-7 h-7" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L11.586 9 7.293 4.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <div className="max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.signedUrl}
              alt={active.caption ?? TYPE_LABEL[active.type]}
              className="max-w-full max-h-[85vh] object-contain rounded"
            />
            <div className="text-center mt-3 text-white/80 text-xs">
              <p className="uppercase tracking-widest">{TYPE_LABEL[active.type]}</p>
              {active.caption && <p className="mt-1 text-white/60">{active.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
