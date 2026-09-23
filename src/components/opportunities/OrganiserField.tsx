"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, X } from "lucide-react";

interface PartnerHit {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
}

interface Props {
  value: string;
  linkedProfileId: string | null;
  onChange: (organiser: string, linkedProfileId: string | null) => void;
  className: string;
  /** Off: a plain text input, and any existing link is left untouched. */
  allowLink?: boolean;
}

/**
 * Organiser text input. Type a plain name as before, or start with "@" to
 * search partner accounts and link the listing to one. The text stays the
 * display name either way.
 */
export function OrganiserField({ value, linkedProfileId, onChange, className, allowLink = true }: Props) {
  const [hits, setHits] = useState<PartnerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [linkedHandle, setLinkedHandle] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.startsWith("@") ? value.slice(1).trim() : null;

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (linkedProfileId || query === null) {
      setHits([]);
      setOpen(false);
      return;
    }
    setOpen(true);
    setSearched(false);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/partners?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { partners?: PartnerHit[] };
        setHits(data.partners ?? []);
      } catch {
        setHits([]);
      } finally {
        setSearched(true);
      }
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, linkedProfileId]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(hit: PartnerHit) {
    setLinkedHandle(hit.username);
    setOpen(false);
    onChange(hit.name, hit.id);
  }

  if (!allowLink) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, linkedProfileId)}
        placeholder="e.g. Creative New Zealand"
        required
        className={className}
      />
    );
  }

  if (linkedProfileId) {
    return (
      <div className="flex items-center gap-2 border border-black bg-background px-3 py-2 text-base sm:text-sm">
        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {value}
          <span className="ml-2 text-xs text-muted-foreground">
            {linkedHandle ? `@${linkedHandle}` : "Linked partner account"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setLinkedHandle(null);
            onChange(value, null);
          }}
          aria-label="Unlink partner account"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        onFocus={() => query !== null && setOpen(true)}
        onBlur={() => {
          // An unresolved "@name" is not a real organiser; keep just the name.
          setTimeout(() => {
            if (value.startsWith("@")) onChange(value.replace(/^@\s*/, ""), null);
          }, 150);
        }}
        placeholder="e.g. Creative New Zealand, or type @ to link a partner"
        required
        autoComplete="off"
        className={className}
      />
      {open && query !== null && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border border-black bg-background shadow-md">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(h)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
            >
              {h.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.avatar_url} alt="" className="h-7 w-7 shrink-0 border border-black object-cover" />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-black bg-muted text-xs font-medium">
                  {h.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{h.name}</span>
                <span className="block truncate text-xs text-muted-foreground">@{h.username}</span>
              </span>
            </button>
          ))}
          {searched && hits.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No partner account found. Remove the @ to type the organiser&rsquo;s name instead.
            </p>
          )}
          {!searched && hits.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          )}
        </div>
      )}
    </div>
  );
}
