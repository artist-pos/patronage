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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ opportunities: [], artists: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open on '/' keypress (when not in a text field)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input when opened; reset when closed
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setResults({ opportunities: [], artists: [] });
    }
  }, [open]);

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

  return (
    <>
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1"
      >
        <Search className="w-4 h-4" />
        <span className="hidden lg:inline text-xs border border-border px-1.5 py-0.5 font-mono leading-none">
          /
        </span>
      </button>

      {/* ── Overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Panel — slides down from top on desktop, full-width on mobile */}
          <div className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-20">
            <div className="mx-auto max-w-xl border border-black bg-background">

              {/* Input row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search opportunities, artists, locations…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close search"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results */}
              {query.length >= 2 && (
                <div className="max-h-[60vh] overflow-y-auto">
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
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border last:border-0"
                        >
                          {/* Thumbnail */}
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
                          onClick={() => setOpen(false)}
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
                </div>
              )}

              {/* Empty state hint */}
              {!query && (
                <div className="px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Try: &ldquo;Auckland&rdquo;, &ldquo;Photography&rdquo;, &ldquo;residency&rdquo;</span>
                  <span className="font-mono">ESC to close</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
