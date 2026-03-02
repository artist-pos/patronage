"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  organiser: string;
  type: string;
  country: string;
  city: string | null;
  deadline: string | null;
  featured_image_url: string | null;
}

interface Artist {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  medium: string[] | null;
  country: string | null;
}

interface Results {
  opportunities: Opportunity[];
  artists: Artist[];
}

export function SearchCommand() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ opportunities: [], artists: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // '/' shortcut focuses the input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2) {
      setResults({ opportunities: [], artists: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 280);
  }, [query]);

  const hasResults = results.opportunities.length > 0 || results.artists.length > 0;

  function clear() {
    setQuery("");
    setResults({ opportunities: [], artists: [] });
    inputRef.current?.focus();
  }

  function closeAndNavigate() {
    setOpen(false);
    setQuery("");
    setResults({ opportunities: [], artists: [] });
  }

  return (
    <div ref={containerRef} className="relative hidden sm:flex items-center flex-1 max-w-sm">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search artists, regions, or opportunities..."
        className="w-full pl-8 pr-7 py-1.5 text-xs border border-border focus:border-foreground outline-none bg-background transition-colors"
      />
      {query && (
        <button
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[440px] max-w-[calc(100vw-2rem)] border border-black bg-background z-50 max-h-[60vh] overflow-y-auto">

          {/* Empty state hint */}
          {!query && (
            <div className="px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Try: &ldquo;Auckland&rdquo;, &ldquo;Photography&rdquo;, &ldquo;residency&rdquo;</span>
              <span className="font-mono">ESC to close</span>
            </div>
          )}

          {query.length >= 2 && (
            <>
              {loading && (
                <p className="px-4 py-4 text-xs text-muted-foreground">Searching…</p>
              )}

              {!loading && !hasResults && (
                <p className="px-4 py-4 text-xs text-muted-foreground">
                  No results for &ldquo;{query}&rdquo;
                </p>
              )}

              {results.opportunities.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted/40 border-b border-border">
                    Opportunities
                  </p>
                  {results.opportunities.map((opp) => (
                    <Link
                      key={opp.id}
                      href={`/opportunities/${opp.id}`}
                      onClick={closeAndNavigate}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border last:border-0"
                    >
                      <div className="w-8 h-8 shrink-0 border border-black bg-white overflow-hidden flex items-center justify-center">
                        {opp.featured_image_url ? (
                          <Image
                            src={opp.featured_image_url}
                            alt={opp.title}
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[8px] font-mono text-muted-foreground uppercase">
                            {opp.type.slice(0, 3)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{opp.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {opp.organiser} · {opp.city ? `${opp.city}, ` : ""}{opp.country}
                        </p>
                      </div>
                      {opp.deadline && (
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {opp.deadline}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {results.artists.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted/40 border-b border-border">
                    Artists
                  </p>
                  {results.artists.map((artist) => (
                    <Link
                      key={artist.id}
                      href={`/${artist.username}`}
                      onClick={closeAndNavigate}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border last:border-0"
                    >
                      {artist.avatar_url ? (
                        <div className="relative w-8 h-8 shrink-0 border border-black overflow-hidden">
                          <Image
                            src={artist.avatar_url}
                            alt={artist.full_name ?? artist.username}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 shrink-0 border border-black bg-muted flex items-center justify-center text-xs font-medium">
                          {(artist.full_name ?? artist.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {artist.full_name ?? artist.username}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{artist.username}
                          {artist.medium?.length ? ` · ${artist.medium.slice(0, 2).join(", ")}` : ""}
                        </p>
                      </div>
                      {artist.country && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {artist.country}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
