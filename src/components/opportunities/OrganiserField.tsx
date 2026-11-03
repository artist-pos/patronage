"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Plus, X } from "lucide-react";
import { NewOrganisationModal } from "@/components/admin/NewOrganisationModal";

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
  /** Admins only: the "@" search also offers to create the organisation's
   *  unclaimed (shadow) account and link the listing to it. */
  allowCreate?: boolean;
}

/** Same folding as the scraper's organiser-link: case, macrons, punctuation. */
function fold(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The organiser text without a trailing "(NZFC)"-style alias. */
const withoutAlias = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

/**
 * Organiser text input. Type a plain name as before, or start with "@" to
 * search partner accounts and link the listing to one. The text stays the
 * display name either way. When the name matches a partner account exactly,
 * it offers the link. For admins, the "@" search also offers "Create … as a
 * new organisation", the same shadow-profile setup as Admin → Claim tokens.
 */
export function OrganiserField({ value, linkedProfileId, onChange, className, allowLink = true, allowCreate = false }: Props) {
  const [hits, setHits] = useState<PartnerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [linkedHandle, setLinkedHandle] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<PartnerHit | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.startsWith("@") ? value.slice(1).trim() : null;

  // Offer a link when the plain organiser name matches a partner exactly.
  useEffect(() => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    const name = withoutAlias(value);
    if (!allowLink || linkedProfileId || query !== null || name.length < 3) {
      setSuggestion(null);
      return;
    }
    suggestTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/partners?q=${encodeURIComponent(name)}`);
        const data = (await res.json()) as { partners?: PartnerHit[] };
        const keys = new Set([fold(value), fold(name)]);
        setSuggestion((data.partners ?? []).find((p) => keys.has(fold(p.name))) ?? null);
      } catch {
        setSuggestion(null);
      }
    }, 400);
    return () => {
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };
  }, [value, query, linkedProfileId, allowLink]);

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
        const res = await fetch(`/api/search/partners?q=${encodeURIComponent(withoutAlias(query))}`);
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

  // Keep the organiser's own wording ("… (NZFC)") when accepting a suggestion.
  function acceptSuggestion(hit: PartnerHit) {
    setLinkedHandle(hit.username);
    setSuggestion(null);
    onChange(value, hit.id);
  }

  const modal = creatingName !== null && (
    <NewOrganisationModal
      initialName={creatingName}
      onClose={() => setCreatingName(null)}
      onCreated={(p) => {
        setCreatingName(null);
        setLinkedHandle(p.username);
        onChange(p.name, p.id);
      }}
    />
  );

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
      {suggestion && dismissed !== suggestion.id && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Matches a partner account:</span>
          <button
            type="button"
            onClick={() => acceptSuggestion(suggestion)}
            className="inline-flex items-center gap-1.5 border border-foreground px-2 py-1 font-medium transition-colors hover:bg-foreground hover:text-background"
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Link to {suggestion.name} (@{suggestion.username})
          </button>
          <button
            type="button"
            onClick={() => setDismissed(suggestion.id)}
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Not this one
          </button>
        </div>
      )}
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
          {searched && hits.length === 0 && !allowCreate && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No partner account found. Remove the @ to type the organiser&rsquo;s name instead.
            </p>
          )}
          {!searched && hits.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          )}
          {/* Shown even with matches: the right organisation may not be among them. */}
          {searched && allowCreate && query.length >= 2 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                setCreatingName(withoutAlias(query));
              }}
              className="flex w-full items-center gap-3 border-t border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-dashed border-black">
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">Create &ldquo;{withoutAlias(query)}&rdquo;</span>
                <span className="block truncate text-xs text-muted-foreground">New organisation (shadow profile), linked to this listing</span>
              </span>
            </button>
          )}
        </div>
      )}
      {modal}
    </div>
  );
}
