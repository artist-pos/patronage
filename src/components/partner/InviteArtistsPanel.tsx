"use client";

import { useState, useCallback, useRef } from "react";
import { Search, Copy, Check, Link2 } from "lucide-react";

interface ArtistResult {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  opportunityId: string;
  opportunityTitle: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export function InviteArtistsPanel({ opportunityId, opportunityTitle }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const applyUrl = `${SITE_URL}/opportunities/${opportunityId}`;

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/partner/search-artists?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.artists ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(value), 300);
  }

  async function copyInviteLink(artist: ArtistResult) {
    const text = `Hi ${artist.full_name ?? artist.username} — I’d like to invite you to apply for "${opportunityTitle}" on Patronage: ${applyUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(artist.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyDirectLink() {
    try {
      await navigator.clipboard.writeText(applyUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-4">
      {/* Direct link */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border border-black/10 px-3 py-2 text-sm text-stone-600 truncate bg-stone-50">
          {applyUrl}
        </div>
        <button
          type="button"
          onClick={copyDirectLink}
          className="shrink-0 inline-flex items-center gap-1.5 border border-black/10 px-3 py-2 text-sm hover:bg-stone-50 transition-colors"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5" />
              Copy link
            </>
          )}
        </button>
      </div>

      {/* Artist search */}
      <div className="space-y-2">
        <p className="text-xs text-stone-500">
          Search for artists on Patronage and copy a personalised invite message to send them.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search artists by name…"
            className="w-full border border-black/10 pl-9 pr-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-black/20"
          />
        </div>
      </div>

      {/* Results */}
      {searching && (
        <p className="text-xs text-stone-400">Searching…</p>
      )}

      {results.length > 0 && (
        <div className="border border-black/10 divide-y divide-black/5">
          {results.map((artist) => (
            <div key={artist.id} className="flex items-center gap-3 px-4 py-3">
              {artist.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {artist.full_name ?? artist.username}
                </p>
                <p className="text-xs text-stone-400 truncate">@{artist.username}</p>
              </div>
              <button
                type="button"
                onClick={() => copyInviteLink(artist)}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-stone-500 hover:text-foreground transition-colors px-2 py-1"
              >
                {copiedId === artist.id ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy invite
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-stone-400">No artists found.</p>
      )}
    </div>
  );
}
