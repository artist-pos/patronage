"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteSeries } from "@/app/studio/series/actions";

interface SeriesCard {
  id: string;
  title: string;
  slug: string;
  hero_image_url: string | null;
  artworkCount: number;
}

interface Props {
  series: SeriesCard[];
}

export function SeriesTab({ series: initialSeries }: Props) {
  const [series, setSeries] = useState(initialSeries);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Remove the series "${title}"? The individual artworks won't be deleted.`)) return;
    setDeleting(id);
    const result = await deleteSeries(id);
    if (result.error) {
      setError(result.error);
    } else {
      setSeries(prev => prev.filter(s => s.id !== id));
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Group related works under a shared page. Each work keeps its own price and provenance.
        </p>
        <Link
          href="/studio/series/new"
          className="text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity font-medium shrink-0 ml-4"
        >
          + Add Series
        </Link>
      </div>

      {error && (
        <p className="text-xs text-destructive border border-destructive/30 px-3 py-2">{error}</p>
      )}

      {series.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg px-6 py-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No series yet.</p>
          <Link
            href="/studio/series/new"
            className="inline-block text-xs border border-border px-4 py-2 hover:bg-muted/40 transition-colors"
          >
            + Create your first series
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {series.map(s => (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <div className="w-11 h-11 shrink-0 overflow-hidden bg-muted border border-border">
                {s.hero_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.hero_image_url} alt={s.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-stone-100" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.artworkCount} {s.artworkCount === 1 ? "work" : "works"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/studio/series/${s.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 border border-border"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(s.id, s.title)}
                  disabled={deleting === s.id}
                  className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
