"use client";

import { useState, useEffect, useRef, useMemo, useTransition, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { X, Bookmark, BookmarkCheck } from "lucide-react";
import { saveWorksLayout } from "@/app/feed/works-layout-actions";
import { formatPrice } from "@/lib/format-price";

export interface ArtworkForGrid {
  id: string;
  url: string;
  title: string | null;
  caption: string | null;
  price_cents: number | null;
  is_poa: boolean;
  price_currency: "NZD" | "AUD";
  medium: string | null;
  hide_price: boolean;
  hide_available?: boolean;
  listing_mode?: "direct_sale" | "enquire_first" | null;
  location_text?: string | null;
  show_location_publicly?: boolean;
  profile: {
    id?: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export type WorksGridLayout = "justified" | "list";

const SAVED_WORKS_KEY = "patronage_saved_works";

function useSavedWorks() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_WORKS_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setSavedIds(new Set(ids));
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const toggle = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(SAVED_WORKS_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { savedIds, toggle, loaded };
}

export interface OwnerActions {
  onUnlist: (id: string) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onMarkCollected: (id: string) => void;
  hiddenIds: Set<string>;
}

interface Props {
  artworks: ArtworkForGrid[];
  isAdmin?: boolean;
  initialRowH?: number;
  initialHGap?: number;
  initialVGap?: number;
  initialLastRowAlign?: "left" | "center" | "right";
  layout?: WorksGridLayout;
  initialOpenArtworkId?: string;
  ownerActions?: OwnerActions;
}

const DEFAULT_ROW_H = 300;
const DEFAULT_H_GAP = 4;
const DEFAULT_V_GAP = 12;

interface Tile { artwork: ArtworkForGrid; w: number; h: number }
interface Row  { tiles: Tile[]; isLast: boolean }

function buildRows(
  artworks: ArtworkForGrid[],
  dims: Record<string, { w: number; h: number }>,
  containerW: number,
  targetH: number,
  hGap: number,
): Row[] {
  if (containerW <= 0 || artworks.length === 0) return [];

  const rows: Row[] = [];
  let batch: ArtworkForGrid[] = [];
  let batchAR = 0;

  for (const art of artworks) {
    const d = dims[art.id];
    const ar = d && d.h > 0 ? d.w / d.h : 1;
    batch.push(art);
    batchAR += ar;

    const rowH = (containerW - (batch.length - 1) * hGap) / batchAR;

    if (rowH <= targetH) {
      const tiles: Tile[] = batch.map((a) => {
        const da = dims[a.id];
        const r = da && da.h > 0 ? da.w / da.h : 1;
        return { artwork: a, w: Math.round(r * rowH), h: Math.round(rowH) };
      });
      const used = tiles.reduce((s, t) => s + t.w, 0) + (tiles.length - 1) * hGap;
      tiles[tiles.length - 1].w += containerW - used;
      rows.push({ tiles, isLast: false });
      batch = [];
      batchAR = 0;
    }
  }

  if (batch.length > 0) {
    rows.push({
      tiles: batch.map((a) => {
        const da = dims[a.id];
        const r = da && da.h > 0 ? da.w / da.h : 1;
        return { artwork: a, w: Math.round(r * targetH), h: targetH };
      }),
      isLast: true,
    });
  }

  return rows;
}

function ArtistAvatar({
  avatarUrl,
  displayName,
  size = 20,
}: {
  avatarUrl: string | null;
  displayName: string;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <Image
          src={avatarUrl}
          alt={displayName}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      </div>
    );
  }
  if (displayName) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#e7e5e4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.5,
          color: "#78716c",
          flexShrink: 0,
          fontWeight: 500,
        }}
      >
        {displayName.charAt(0).toUpperCase()}
      </div>
    );
  }
  return null;
}

function WorksLightbox({
  artworks,
  index,
  onClose,
  onPrev,
  onNext,
  savedIds,
  onToggleSave,
  ownerActions,
}: {
  artworks: ArtworkForGrid[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  ownerActions?: OwnerActions;
}) {
  const artwork = artworks[index];
  const [collectModal, setCollectModal] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onPrev();
      if (e.key === "ArrowRight" && index < artworks.length - 1) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, artworks.length, onClose, onPrev, onNext]);

  if (!artwork) return null;

  const title = artwork.title ?? artwork.caption ?? "Untitled";
  const displayName = artwork.profile?.full_name ?? artwork.profile?.username ?? "";
  const profileHref = artwork.profile ? `/${artwork.profile.username}` : "#";
  const workHref = artwork.profile
    ? `/${artwork.profile.username}?tab=work&artwork=${artwork.id}`
    : "#";
  const formattedPrice = !artwork.hide_price
    ? formatPrice(artwork.price_cents, artwork.price_currency, artwork.is_poa)
    : null;
  const isSaved = savedIds.has(artwork.id);
  const isHidden = ownerActions?.hiddenIds.has(artwork.id) ?? false;

  return (
    <>
      {/* Place in collection modal rendered via dynamic import to keep bundle small */}
      {collectModal && (
        <PlaceInCollectionModalWrapper
          artworkId={artwork.id}
          artworkTitle={artwork.title ?? artwork.caption}
          onClose={() => setCollectModal(false)}
          onSuccess={() => {
            setCollectModal(false);
            ownerActions?.onMarkCollected(artwork.id);
          }}
        />
      )}

      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        {/* Close — absolute top-right of viewport */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-stone-600" />
        </button>

        {/* Modal card — no rounded corners, image + info panel side by side */}
        <div
          className="flex overflow-hidden shadow-2xl"
          style={{ maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image — natural aspect ratio, no letterboxing background */}
          <div className="relative flex-shrink-0 self-stretch flex items-center">
            {/* Bookmark overlay — top-right on the image */}
            <button
              type="button"
              onClick={() => onToggleSave(artwork.id)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-colors shadow-sm"
              aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
            >
              {isSaved ? (
                <BookmarkCheck className="w-4 h-4 text-black" />
              ) : (
                <Bookmark className="w-4 h-4 text-stone-500" />
              )}
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artwork.url}
              alt={title}
              style={{ height: "90vh", width: "auto", maxWidth: "70vw", display: "block" }}
            />
          </div>

          {/* Info panel */}
          <div
            className="bg-white flex flex-col"
            style={{ width: 280, overflowY: "auto" }}
          >
            <div className="flex-1 p-6 space-y-5">
              {/* Title */}
              <div>
                <h2 className="text-sm font-semibold leading-snug text-foreground">{title}</h2>
                {isHidden && (
                  <span className="inline-block mt-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground bg-stone-100 px-2 py-0.5 rounded">
                    Hidden
                  </span>
                )}
              </div>

              {/* Artist */}
              {artwork.profile && (
                <Link
                  href={profileHref}
                  className="flex items-center gap-2 group"
                >
                  <ArtistAvatar
                    avatarUrl={artwork.profile.avatar_url}
                    displayName={displayName}
                    size={24}
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {displayName}
                  </span>
                </Link>
              )}

              {/* Medium */}
              {artwork.medium && (
                <p className="text-xs text-muted-foreground">{artwork.medium}</p>
              )}

              {/* Location — owner always sees it; public only if show_location_publicly */}
              {artwork.location_text && (ownerActions || artwork.show_location_publicly) && (
                <p className="text-xs text-muted-foreground">{artwork.location_text}</p>
              )}

              {/* Price */}
              {formattedPrice && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-foreground">{formattedPrice}</span>
                </div>
              )}

              {/* Enquire / Buy / Make an offer — shown to non-owners when artist ID is known */}
              {!ownerActions && artwork.profile?.id && (
                <WorkDetailActionsWrapper
                  artistId={artwork.profile.id}
                  artistName={displayName}
                  artworkId={artwork.id}
                  workTitle={artwork.title ?? artwork.caption}
                  workDescription={artwork.caption}
                  priceCents={artwork.price_cents}
                  isPoa={artwork.is_poa}
                  priceCurrency={artwork.price_currency}
                  hidePrice={artwork.hide_price}
                  listingMode={artwork.listing_mode ?? "enquire_first"}
                  workImageUrl={artwork.url}
                />
              )}

              {/* Owner actions */}
              {ownerActions && (
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                    Manage
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => ownerActions.onUnlist(artwork.id)}
                      className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-stone-50 transition-colors"
                    >
                      Unlist
                    </button>
                    <button
                      type="button"
                      onClick={() => ownerActions.onToggleHide(artwork.id, !isHidden)}
                      className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-stone-50 transition-colors"
                    >
                      {isHidden ? "Show" : "Hide"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectModal(true)}
                      className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-stone-50 transition-colors"
                    >
                      Collected
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 border-t border-border pt-4">
              <Link
                href={workHref}
                className="block text-sm font-medium text-foreground hover:underline"
              >
                View {displayName}&apos;s profile →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Lazy wrapper for WorkDetailActions to keep it out of the initial bundle
function WorkDetailActionsWrapper({
  artistId,
  artistName,
  artworkId,
  workTitle,
  workDescription,
  priceCents,
  isPoa,
  priceCurrency,
  hidePrice,
  listingMode,
  workImageUrl,
}: {
  artistId: string;
  artistName: string;
  artworkId: string;
  workTitle: string | null;
  workDescription: string | null;
  priceCents: number | null;
  isPoa: boolean;
  priceCurrency: "NZD" | "AUD";
  hidePrice: boolean;
  listingMode: "direct_sale" | "enquire_first";
  workImageUrl?: string | null;
}) {
  const [Actions, setActions] = useState<React.ComponentType<{
    artistId: string; artistName: string; artworkId: string;
    workTitle: string | null; workDescription: string | null;
    priceCents: number | null; isPoa: boolean; priceCurrency: "NZD" | "AUD";
    hidePrice: boolean; listingMode: "direct_sale" | "enquire_first";
    workImageUrl?: string | null;
  }> | null>(null);

  useEffect(() => {
    import("@/components/profile/WorkDetailActions").then((m) => {
      setActions(() => m.WorkDetailActions);
    });
  }, []);

  if (!Actions) return null;
  return (
    <Actions
      artistId={artistId}
      artistName={artistName}
      artworkId={artworkId}
      workTitle={workTitle}
      workDescription={workDescription}
      priceCents={priceCents}
      isPoa={isPoa}
      priceCurrency={priceCurrency}
      hidePrice={hidePrice}
      listingMode={listingMode}
      workImageUrl={workImageUrl}
    />
  );
}

// Lazy wrapper for PlaceInCollectionModal to avoid loading it upfront
function PlaceInCollectionModalWrapper({
  artworkId,
  artworkTitle,
  onClose,
  onSuccess,
}: {
  artworkId: string;
  artworkTitle: string | null | undefined;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [Modal, setModal] = useState<React.ComponentType<{
    artworkId: string;
    artworkTitle: string | null;
    onClose: () => void;
    onSuccess: () => void;
  }> | null>(null);

  useEffect(() => {
    import("@/components/profile/PlaceInCollectionModal").then((m) => {
      setModal(() => m.PlaceInCollectionModal);
    });
  }, []);

  if (!Modal) return null;
  return (
    <Modal
      artworkId={artworkId}
      artworkTitle={artworkTitle ?? null}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

export function WorksJustifiedGrid({
  artworks,
  isAdmin,
  initialRowH,
  initialHGap,
  initialVGap,
  initialLastRowAlign,
  layout = "justified",
  initialOpenArtworkId,
  ownerActions,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rowH, setRowH] = useState(initialRowH ?? DEFAULT_ROW_H);
  const [hGap, setHGap] = useState(initialHGap ?? DEFAULT_H_GAP);
  const [vGap, setVGap] = useState(initialVGap ?? DEFAULT_V_GAP);
  const [lastRowAlign, setLastRowAlign] = useState<"left" | "center" | "right">(initialLastRowAlign ?? "left");
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [, startTransition] = useTransition();
  const { savedIds, toggle: toggleSave, loaded: savedLoaded } = useSavedWorks();

  const displayedArtworks = useMemo(
    () => (showSavedOnly && savedLoaded ? artworks.filter((a) => savedIds.has(a.id)) : artworks),
    [artworks, showSavedOnly, savedLoaded, savedIds],
  );

  // Auto-exit saved filter when the last saved work is unsaved
  useEffect(() => {
    if (showSavedOnly && savedLoaded && !artworks.some((a) => savedIds.has(a.id))) {
      setShowSavedOnly(false);
    }
  }, [savedIds, showSavedOnly, savedLoaded, artworks]);

  // Resolve initial lightbox from prop or URL param
  useEffect(() => {
    const artworkId = initialOpenArtworkId ?? searchParams.get("artwork");
    if (artworkId) {
      const idx = artworks.findIndex((a) => a.id === artworkId);
      if (idx >= 0) setLightboxIndex(idx);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL when lightbox opens/closes
  const openLightbox = useCallback((idx: number) => {
    setLightboxIndex(idx);
    const artwork = displayedArtworks[idx];
    if (!artwork) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("artwork", artwork.id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [displayedArtworks, router, searchParams]);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("artwork");
    const newSearch = params.toString();
    router.replace(newSearch ? `?${newSearch}` : window.location.pathname, { scroll: false });
  }, [router, searchParams]);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => {
      const next = Math.min(displayedArtworks.length - 1, (i ?? 0) + 1);
      const artwork = displayedArtworks[next];
      if (artwork) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("artwork", artwork.id);
        router.replace(`?${params.toString()}`, { scroll: false });
      }
      return next;
    });
  }, [displayedArtworks, router, searchParams]);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => {
      const prev = Math.max(0, (i ?? 1) - 1);
      const artwork = displayedArtworks[prev];
      if (artwork) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("artwork", artwork.id);
        router.replace(`?${params.toString()}`, { scroll: false });
      }
      return prev;
    });
  }, [displayedArtworks, router, searchParams]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.offsetWidth);
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function handleLoad(id: string, e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w > 0 && h > 0) setDims((prev) => ({ ...prev, [id]: { w, h } }));
  }

  const rows = useMemo(
    () =>
      containerW !== null && layout === "justified"
        ? buildRows(displayedArtworks, dims, containerW, rowH, hGap)
        : [],
    [displayedArtworks, dims, containerW, rowH, hGap, layout],
  );

  function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    startTransition(async () => {
      const result = await saveWorksLayout(rowH, hGap, vGap, lastRowAlign);
      if (result?.error) {
        setSaveState("error");
        setSaveError(result.error);
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    });
  }

  if (artworks.length === 0) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        No works available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Saved filter toggle — only shown after localStorage loads and there are saved works in this view */}
      {savedLoaded && artworks.some((a) => savedIds.has(a.id)) && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSavedOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              showSavedOnly
                ? "bg-black text-white border-black"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
            }`}
          >
            <BookmarkCheck className="w-3 h-3" />
            Saved ({artworks.filter((a) => savedIds.has(a.id)).length})
          </button>
        </div>
      )}
      {/* Admin layout controls — justified only */}
      {isAdmin && layout === "justified" && (
        <div className="flex flex-wrap items-center gap-6 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Row height: {rowH}px
            </label>
            <input
              type="range" min={120} max={600} step={10} value={rowH}
              onChange={(e) => setRowH(Number(e.target.value))}
              className="w-28 accent-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              H-gap: {hGap}px
            </label>
            <input
              type="range" min={0} max={32} step={1} value={hGap}
              onChange={(e) => setHGap(Number(e.target.value))}
              className="w-20 accent-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              V-gap: {vGap}px
            </label>
            <input
              type="range" min={0} max={48} step={2} value={vGap}
              onChange={(e) => setVGap(Number(e.target.value))}
              className="w-20 accent-black"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Last row</label>
            <div className="flex border border-border rounded overflow-hidden">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => setLastRowAlign(align)}
                  title={align.charAt(0).toUpperCase() + align.slice(1)}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    lastRowAlign === align
                      ? "bg-black text-white"
                      : "hover:bg-stone-100 text-stone-600"
                  }`}
                >
                  {align === "left" ? "⬛▫▫" : align === "center" ? "▫⬛▫" : "▫▫⬛"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="text-xs px-3 py-1.5 border border-black hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Save layout"}
            </button>
            {saveState === "error" && saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
          </div>
        </div>
      )}

      {/* List layout */}
      {layout === "list" && (
        <div className="divide-y divide-border">
          {displayedArtworks.map((artwork, idx) => {
            const title = artwork.title ?? artwork.caption ?? "Untitled";
            const displayName = artwork.profile?.full_name ?? artwork.profile?.username ?? "";
            const profileHref = artwork.profile ? `/${artwork.profile.username}` : "#";
            const formattedPrice = !artwork.hide_price
              ? formatPrice(artwork.price_cents, artwork.price_currency, artwork.is_poa)
              : null;
            const isHidden = ownerActions?.hiddenIds.has(artwork.id) ?? false;
            return (
              <div
                key={artwork.id}
                className="flex items-center gap-4 py-3 -mx-2 px-2 hover:bg-stone-50 transition-colors cursor-pointer group"
                onClick={() => openLightbox(idx)}
              >
                <div className="w-14 h-14 flex-shrink-0 overflow-hidden bg-stone-100 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={artwork.url}
                    alt={title}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                  {isHidden && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="text-[8px] text-white font-mono uppercase tracking-wider">Hidden</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <Link
                    href={profileHref}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {displayName}
                  </Link>
                  {artwork.medium && (
                    <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{artwork.medium}</p>
                  )}
                </div>
                {formattedPrice && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium">{formattedPrice}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Justified grid layout */}
      {layout === "justified" && (
        <div ref={containerRef}>
          {rows.map((row, ri) => (
            <div
              key={ri}
              style={{
                display: "flex",
                gap: hGap,
                marginBottom: ri < rows.length - 1 ? vGap : 0,
                justifyContent: row.isLast
                  ? lastRowAlign === "center" ? "center" : lastRowAlign === "right" ? "flex-end" : "flex-start"
                  : "flex-start",
                alignItems: "flex-start",
              }}
            >
              {row.tiles.map(({ artwork, w, h }) => {
                const displayName = artwork.profile?.full_name ?? artwork.profile?.username ?? "";
                const title = artwork.title ?? artwork.caption ?? "Untitled";
                const profileHref = artwork.profile ? `/${artwork.profile.username}` : "#";
                const formattedPrice = !artwork.hide_price
                  ? formatPrice(artwork.price_cents, artwork.price_currency, artwork.is_poa)
                  : null;
                const artworkIndex = displayedArtworks.indexOf(artwork);
                const isSaved = savedLoaded && savedIds.has(artwork.id);
                const isHovered = hoveredId === artwork.id;
                const isHidden = ownerActions?.hiddenIds.has(artwork.id) ?? false;

                return (
                  <div
                    key={artwork.id}
                    style={{ width: w, flexShrink: 0, minWidth: 0 }}
                  >
                    {/* Image tile — click opens lightbox */}
                    <div
                      style={{
                        width: w,
                        height: h,
                        overflow: "hidden",
                        position: "relative",
                        cursor: "pointer",
                      }}
                      onClick={() => openLightbox(artworkIndex)}
                      onMouseEnter={() => setHoveredId(artwork.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artwork.url}
                        alt={title}
                        loading="lazy"
                        onLoad={(e) => handleLoad(artwork.id, e)}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                          background: "#FAFAF9",
                          transition: "transform 0.3s ease",
                          transform: isHovered ? "scale(1.02)" : "scale(1)",
                        }}
                      />

                      {/* Hover gradient overlay — visual affordance only, no text */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          opacity: isHovered ? 1 : 0,
                          transition: "opacity 0.2s ease",
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)",
                          pointerEvents: "none",
                        }}
                      />

                      {/* "For sale" badge — top-left, hover only */}
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          opacity: isHovered ? 1 : 0,
                          transition: "opacity 0.2s ease",
                          pointerEvents: "none",
                        }}
                      >
                        <span className="flex items-center gap-1 bg-white/90 text-[10px] font-medium text-stone-700 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          For sale
                        </span>
                      </div>

                      {/* Bookmark icon — top-right, hover only */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSave(artwork.id); }}
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          opacity: isHovered ? 1 : 0,
                          transition: "opacity 0.2s ease",
                          background: "rgba(255,255,255,0.85)",
                          border: "none",
                          borderRadius: "50%",
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          backdropFilter: "blur(2px)",
                        }}
                        aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-3.5 h-3.5 text-black" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5 text-stone-600" />
                        )}
                      </button>

                      {/* Hidden badge — always visible for owner */}
                      {isHidden && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 6,
                            left: 6,
                            pointerEvents: "none",
                          }}
                        >
                          <span className="text-[9px] font-mono uppercase tracking-widest text-white bg-black/60 px-2 py-0.5 rounded">
                            Hidden
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Below tile: avatar + artist name + title + medium + price */}
                    <div style={{ paddingTop: 6, width: w, overflow: "hidden" }}>
                      {/* Artist row */}
                      <Link
                        href={profileHref}
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none", marginBottom: 2 }}
                      >
                        <ArtistAvatar
                          avatarUrl={artwork.profile?.avatar_url ?? null}
                          displayName={displayName}
                          size={14}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: "#78716c",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {displayName}
                        </span>
                      </Link>

                      {/* Title */}
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#1c1917",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          lineHeight: 1.3,
                          margin: 0,
                        }}
                      >
                        {title}
                      </p>

                      {/* Medium */}
                      {artwork.medium && (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#a8a29e",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            margin: "1px 0 0",
                          }}
                        >
                          {artwork.medium}
                        </p>
                      )}

                      {/* Price */}
                      {formattedPrice && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#10b981",
                              flexShrink: 0,
                              display: "inline-block",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              color: "#1c1917",
                              fontWeight: 500,
                            }}
                          >
                            {formattedPrice}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <WorksLightbox
          artworks={displayedArtworks}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          ownerActions={ownerActions}
        />
      )}
    </div>
  );
}
