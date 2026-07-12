"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { setSpotlightArtist } from "@/app/artists/actions";

interface Props {
  profileId: string;
  artistName: string;
  isSpotlit: boolean;
}

function defaultUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

/**
 * Admin-only 3-dot menu on directory rows: set an artist as the featured/
 * spotlight artist until a chosen date (one at a time — setting a new one
 * clears the previous), or clear the current spotlight.
 */
export function AdminSpotlightMenu({ profileId, artistName, isSpotlit }: Props) {
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(defaultUntil());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function apply(value: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setSpotlightArtist(profileId, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Admin actions for ${artistName}`}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 w-64 space-y-3 border border-border bg-card p-4 shadow-lg">
          <p className="t-section-label">Featured artist</p>
          {isSpotlit ? (
            <>
              <p className="text-xs text-muted-foreground">
                {artistName} is the current spotlight.
              </p>
              <div className="space-y-2">
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-full border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-foreground"
                />
                <button
                  type="button"
                  disabled={pending || !until}
                  onClick={() => apply(until)}
                  className="w-full bg-foreground px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                >
                  {pending ? "Saving…" : "Extend until date"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => apply(null)}
                  className="w-full border border-border px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40"
                >
                  Remove featured
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">
                Feature {artistName} until
              </label>
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="w-full border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-foreground"
              />
              <button
                type="button"
                disabled={pending || !until}
                onClick={() => apply(until)}
                className="w-full bg-foreground px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {pending ? "Saving…" : "Set as featured artist"}
              </button>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Replaces the current spotlight on /artists and the home page.
              </p>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
