"use client";

import { useState, useRef, useEffect } from "react";
import { X, User } from "lucide-react";

interface ArtistResult {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface SelectedCollaborator {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  value: SelectedCollaborator[];
  onChange: (collaborators: SelectedCollaborator[]) => void;
  excludeIds?: string[];
  label?: string;
}

export function CollaboratorPicker({ value, onChange, excludeIds = [], label = "Tag collaborators" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(value.map(c => c.id));

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const artists: ArtistResult[] = (data.artists ?? []).filter(
          (a: ArtistResult) => !selectedIds.has(a.id) && !excludeIds.includes(a.id)
        );
        setResults(artists);
        setOpen(artists.length > 0);
      } catch { /* ignore */ }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(artist: ArtistResult) {
    onChange([...value, artist]);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(value.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] text-muted-foreground">{label}</label>

      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(c => (
            <span key={c.id} className="flex items-center gap-1.5 bg-stone-100 text-stone-700 text-[11px] px-2 py-1 rounded-full">
              {c.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <User className="w-3 h-3" />
              )}
              <span>@{c.username}</span>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="text-stone-400 hover:text-stone-700 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by name or @username…"
          className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            Searching…
          </span>
        )}

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 z-50 bg-background border border-black shadow-md mt-px max-h-48 overflow-y-auto"
          >
            {results.map(artist => (
              <button
                key={artist.id}
                type="button"
                onClick={() => select(artist)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
              >
                {artist.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artist.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{artist.full_name ?? artist.username}</p>
                  <p className="text-[11px] text-muted-foreground">@{artist.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
