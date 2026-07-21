"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateWorkPrivacy, updateProfilePrivacy } from "@/app/profile/privacy-actions";
import { removeFromArtistProfile, requestArtworkDeletion } from "@/app/profile/artwork-delete-actions";
import type { Artwork } from "@/types/database";

const TILE_H = 260;

interface SoldWork extends Artwork {
  owner_profile: { username: string; full_name: string | null } | null;
}

interface LedgerRow {
  id: string;
  entry_type: string;
  transferred_at: string;
  price: number | null;
}

interface Props {
  initialWorks: SoldWork[];
  isOwner: boolean;
  hideSoldSection: boolean;
}

function entryLabel(type: string): string {
  if (type === "created") return "Created & registered";
  if (type === "transferred") return "Transferred";
  if (type === "resold") return "Resold";
  if (type === "selected") return "Selected for exhibition";
  return type;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function SoldLightbox({
  works,
  index,
  isOwner,
  onClose,
  onPrev,
  onNext,
  onToggleHide,
  onToggleHidePrice,
  onRemove,
  onRequestDeletion,
}: {
  works: SoldWork[];
  index: number;
  isOwner: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleHide: (work: SoldWork) => void;
  onToggleHidePrice: (work: SoldWork) => void;
  onRemove: (id: string) => void;
  onRequestDeletion: (id: string) => void;
}) {
  const work = works[index];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    setConfirmDelete(false);
    setBusy(false);
  }, [index]);

  // Fetch provenance ledger for current work
  useEffect(() => {
    if (!work?.id) return;
    setLedger([]);
    setLedgerLoading(true);
    const supabase = createClient();
    supabase
      .from("artwork_provenance_ledger")
      .select("id, entry_type, transferred_at, price")
      .eq("artwork_id", work.id)
      .order("transferred_at", { ascending: true })
      .then(({ data }) => {
        setLedger((data ?? []) as LedgerRow[]);
        setLedgerLoading(false);
      });
  }, [work?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onPrev();
      if (e.key === "ArrowRight" && index < works.length - 1) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, works.length, onClose, onPrev, onNext]);

  if (!work) return null;

  const ownerName = work.owner_profile?.full_name ?? work.owner_profile?.username;
  const ownerUsername = work.owner_profile?.username;
  const title = work.title ?? work.caption ?? "Untitled";

  const priceStr = work.hide_price
    ? null
    : work.is_poa
    ? "Price on application"
    : work.price_cents
    ? `${work.price_currency} ${(work.price_cents / 100).toLocaleString("en-NZ")}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm z-10"
        aria-label="Close"
      >
        <X className="w-4 h-4 text-stone-600" />
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm z-10"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4 text-stone-600" />
        </button>
      )}

      {/* Next */}
      {index < works.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm z-10"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4 text-stone-600" />
        </button>
      )}

      {/* Modal card */}
      <div
        className="flex flex-col overflow-y-auto sm:flex-row sm:overflow-hidden shadow-2xl w-[calc(100vw-2rem)] sm:w-auto"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image — full colour in lightbox */}
        <div className="relative flex-shrink-0 flex items-center justify-center bg-[#FAFAF9] h-[50vh] sm:h-[90vh] sm:self-stretch">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={work.url}
            alt={title}
            className="h-full w-auto max-w-full block sm:max-w-[70vw]"
            style={{ objectFit: "contain" }}
          />
          {/* Sold badge */}
          <div className="absolute top-3 left-3">
            <span className="flex items-center gap-1 bg-white/90 text-[10px] font-medium text-stone-700 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              Sold
            </span>
          </div>
        </div>

        {/* Info panel */}
        <div className="bg-white flex flex-col w-full sm:w-[300px] sm:overflow-y-auto">
          <div className="flex-1 p-6 space-y-5">

            {/* Title */}
            <div>
              <h2 className="text-sm font-semibold leading-snug">{title}</h2>
              {isOwner && work.hide_from_archive && (
                <span className="inline-block mt-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground bg-stone-100 px-2 py-0.5 rounded">
                  Hidden
                </span>
              )}
            </div>

            {/* Collector */}
            {ownerName && ownerUsername && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                  Collection
                </p>
                <Link
                  href={`/${ownerUsername}`}
                  className="text-xs hover:underline underline-offset-2 transition-colors"
                >
                  {ownerName}
                </Link>
              </div>
            )}

            {/* Details */}
            {(work.year || work.medium || work.dimensions || work.edition || work.description) && (
              <div className="space-y-1.5">
                {work.year && <p className="text-xs text-muted-foreground">{work.year}</p>}
                {work.medium && <p className="text-xs text-muted-foreground">{work.medium}</p>}
                {work.dimensions && <p className="text-xs text-muted-foreground">{work.dimensions}</p>}
                {work.edition && <p className="text-xs text-muted-foreground">{work.edition}</p>}
                {work.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">{work.description}</p>
                )}
              </div>
            )}

            {/* Price */}
            {priceStr && <p className="text-sm font-medium">{priceStr}</p>}

            {/* Provenance ledger */}
            {(ledger.length > 0 || ledgerLoading || work.ledger_id) && (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Provenance
                </p>
                {ledgerLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : ledger.length > 0 ? (
                  <ol className="relative border-l border-stone-200 space-y-0 ml-1">
                    {ledger.map((entry) => (
                      <li key={entry.id} className="ml-3 pb-3 last:pb-0">
                        <div className="absolute -left-[4px] mt-1 h-2 w-2 rounded-full border border-stone-300 bg-white" />
                        <p className="text-[10px] text-stone-400">{formatDate(entry.transferred_at)}</p>
                        <p className="text-xs text-stone-700">{entryLabel(entry.entry_type)}</p>
                        {entry.price != null && (
                          <p className="text-[10px] text-stone-400">
                            NZD {entry.price.toLocaleString()}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {work.ledger_id && (
                  <Link
                    href={`/provenance/${work.ledger_id}`}
                    className="text-[10px] font-mono text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors block"
                  >
                    {work.ledger_id} →
                  </Link>
                )}
              </div>
            )}

            {/* Owner controls */}
            {isOwner && (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Manage
                </p>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onToggleHide(work)}
                    disabled={busy}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    {work.hide_from_archive ? "Show in archive" : "Hide from archive"}
                  </button>
                  <button
                    onClick={() => onToggleHidePrice(work)}
                    disabled={busy}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    {work.hide_price ? "Show price" : "Hide price"}
                  </button>
                  <button
                    onClick={() => { setBusy(true); onRemove(work.id); }}
                    disabled={busy}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Remove from my profile
                  </button>
                  {confirmDelete ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Request patron approval via DM?
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setBusy(true); onRequestDeletion(work.id); }}
                          disabled={busy}
                          className="text-xs text-destructive hover:opacity-70 transition-opacity"
                        >
                          {busy ? "Sending…" : "Yes, send request"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="text-xs text-destructive/70 hover:text-destructive transition-colors text-left"
                    >
                      Request deletion
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SoldWorksSection({ initialWorks, isOwner, hideSoldSection }: Props) {
  const router = useRouter();
  const [works, setWorks] = useState<SoldWork[]>(initialWorks);
  const [sectionHidden, setSectionHidden] = useState(hideSoldSection);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!isOwner && sectionHidden) return null;
  if (!isOwner && works.length === 0) return null;

  const visibleWorks = isOwner ? works : works.filter((w) => !w.hide_from_archive);

  const openLightbox = useCallback((idx: number) => setLightboxIndex(idx), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const goPrev = useCallback(() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const goNext = useCallback(
    () => setLightboxIndex((i) => (i !== null && i < visibleWorks.length - 1 ? i + 1 : i)),
    [visibleWorks.length],
  );

  async function handleToggleHide(work: SoldWork) {
    await updateWorkPrivacy(work.id, "hide_from_archive", !work.hide_from_archive);
    setWorks((prev) =>
      prev.map((w) => (w.id === work.id ? { ...w, hide_from_archive: !work.hide_from_archive } : w))
    );
  }

  async function handleToggleHidePrice(work: SoldWork) {
    await updateWorkPrivacy(work.id, "hide_price", !work.hide_price);
    setWorks((prev) =>
      prev.map((w) => (w.id === work.id ? { ...w, hide_price: !work.hide_price } : w))
    );
  }

  async function handleRemove(workId: string) {
    const result = await removeFromArtistProfile(workId);
    if (!result.error) {
      setWorks((prev) => prev.filter((w) => w.id !== workId));
      closeLightbox();
    }
  }

  async function handleRequestDeletion(workId: string) {
    const result = await requestArtworkDeletion(workId);
    if (result.error) return;
    if (result.conversationId) {
      router.push(`/messages/${result.conversationId}`);
    } else {
      setWorks((prev) => prev.filter((w) => w.id !== workId));
      closeLightbox();
    }
  }

  async function toggleSectionVisibility() {
    const next = !sectionHidden;
    setSectionHidden(next);
    await updateProfilePrivacy("hide_sold_section", next);
  }

  return (
    <>
      {lightboxIndex !== null && (
        <SoldLightbox
          works={visibleWorks}
          index={lightboxIndex}
          isOwner={isOwner}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          onToggleHide={handleToggleHide}
          onToggleHidePrice={handleToggleHidePrice}
          onRemove={handleRemove}
          onRequestDeletion={handleRequestDeletion}
        />
      )}

      {/* Pill — one of the three mutually-exclusive "More work" pills
          (Archive / Available / Sold) in WorkTab; the shared `name` makes
          opening this one close the others natively. The pill's box is
          summary-only (no nested content) so it never resizes when toggled —
          the panel below is a separate sibling within the same .work-panels
          flex container, shown purely via the :has() selector on the right,
          so opening/closing it can never reflow this row. */}
      <details name="work-panel" className="js-sold group/sold">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 border border-border bg-card px-3 py-[7px] font-mono text-[11px] font-normal tracking-normal text-muted-foreground transition-colors hover:border-foreground [&::-webkit-details-marker]:hidden group-open/sold:border-foreground group-open/sold:bg-foreground group-open/sold:text-white">
          <span>Sold</span>
          <span className="text-muted-foreground group-open/sold:text-white/70">
            · {visibleWorks.length}
            {isOwner && sectionHidden ? " · hidden" : ""}
          </span>
          <svg
            aria-hidden
            width="9" height="9" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"
            className="transition-transform group-open/sold:rotate-180"
          >
            <path d="M1.5 3.5 L5 7 L8.5 3.5" />
          </svg>
        </summary>
      </details>

      <div className="js-sold-panel hidden w-full pt-6 [.work-panels:has(.js-sold[open])_&]:block">
        <div className="space-y-4">
        {isOwner && (
          <div className="flex justify-end">
            <button
              onClick={toggleSectionVisibility}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {sectionHidden ? "Show sold section" : "Hide sold section"}
            </button>
          </div>
        )}

        {visibleWorks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sold works to display.</p>
        ) : (
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide"
            style={{ height: TILE_H }}
          >
            {visibleWorks.map((work, idx) => {
              const isHovered = hoveredId === work.id;
              const isHidden = isOwner && work.hide_from_archive;
              const ownerName = work.owner_profile?.full_name ?? work.owner_profile?.username;

              return (
                <div
                  key={work.id}
                  className="relative flex-none overflow-hidden cursor-pointer"
                  style={{
                    height: TILE_H,
                    opacity: isHidden ? 0.3 : 0.6,
                  }}
                  onClick={() => openLightbox(idx)}
                  onMouseEnter={() => setHoveredId(work.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={work.url}
                    alt={work.caption ?? "Sold work"}
                    style={{
                      height: TILE_H,
                      width: "auto",
                      display: "block",
                      objectFit: "contain",
                      background: "#FAFAF9",
                      filter: "grayscale(1)",
                      transition: "transform 0.3s ease",
                      transform: isHovered ? "scale(1.02)" : "scale(1)",
                    }}
                  />

                  {/* Hover gradient */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: isHovered ? 1 : 0,
                      transition: "opacity 0.2s ease",
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Sold badge */}
                  <div className="absolute top-2 left-2" style={{ pointerEvents: "none" }}>
                    <span className="flex items-center gap-1 bg-white/90 text-[10px] font-medium text-stone-700 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                      Sold
                    </span>
                  </div>

                  {/* Hover info */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: "8px 10px",
                      opacity: isHovered ? 1 : 0,
                      transition: "opacity 0.2s ease",
                      pointerEvents: "none",
                    }}
                  >
                    {(work.title ?? work.caption) && (
                      <p className="text-xs font-semibold text-white leading-snug line-clamp-1">
                        {work.title ?? work.caption}
                      </p>
                    )}
                    {ownerName && (
                      <p className="text-[10px] text-white/70 mt-0.5">
                        Collection of {ownerName}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </>
  );
}
