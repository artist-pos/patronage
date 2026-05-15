"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  toggleFeaturedWork,
  toggleHidePortfolioWork,
  toggleHideAvailable,
  deletePortfolioWork,
  unlistWork,
} from "@/app/profile/available-work-actions";
import {
  requestArtworkDeletion,
  removeFromArtistProfile,
} from "@/app/profile/artwork-delete-actions";
import { formatPrice } from "@/lib/format-price";

interface PortfolioRow {
  id: string;
  url: string;
  caption: string | null;
  description: string | null;
  title: string | null;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  linked_artwork_id: string | null;
  is_featured: boolean;
  hide_from_archive: boolean;
  position: number;
  created_at: string;
  content_type: string;
}

interface AvailableRow {
  id: string;
  url: string;
  caption: string | null;
  description: string | null;
  price_cents: number | null;
  is_poa: boolean;
  price_currency: string;
  is_available: boolean;
  hide_available: boolean;
  hide_price: boolean;
  position: number;
  created_at: string;
}

interface SoldRow {
  id: string;
  url: string;
  caption: string | null;
  price_cents: number | null;
  is_poa: boolean;
  price_currency: string;
  created_at: string;
  current_owner_id: string;
  hidden_from_artist: boolean;
  ledger_id?: string | null;
}

interface Props {
  section: "portfolio" | "available" | "sold";
  portfolioWorks: PortfolioRow[];
  availableWorks: AvailableRow[];
  soldWorks: SoldRow[];
  featuredCount: number;
  profileId: string;
  engagementMap?: Record<string, { view: number; play: number }>;
}

function useOutsideClick(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

function MoreMenu({ items }: { items: { label: string; onClick: () => void; destructive?: boolean; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="More actions"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-background border border-border shadow-md z-50 py-1 min-w-[160px]">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); setOpen(false); }}
              disabled={item.disabled}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                item.destructive
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-muted/60"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorksTable({
  section,
  portfolioWorks,
  availableWorks,
  soldWorks,
  featuredCount,
  profileId,
  engagementMap = {},
}: Props) {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>(portfolioWorks);
  const [available, setAvailable] = useState<AvailableRow[]>(availableWorks);
  const [sold, setSold] = useState<SoldRow[]>(soldWorks);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  // ── Portfolio actions ────────────────────────────────────────────────────

  async function toggleFeatured(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleFeaturedWork(id, !current, featuredCount);
    if (result.error) showError(result.error);
    else setPortfolio(prev => prev.map(w => (w.id === id ? { ...w, is_featured: !current } : w)));
    setBusy(null);
  }

  async function toggleHidePortfolio(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleHidePortfolioWork(id, !current);
    if (result.error) showError(result.error);
    else setPortfolio(prev => prev.map(w => (w.id === id ? { ...w, hide_from_archive: !current } : w)));
    setBusy(null);
  }

  async function handleDeletePortfolio(id: string) {
    if (!confirm("Permanently delete this work? This cannot be undone.")) return;
    setBusy(id);
    const result = await deletePortfolioWork(id);
    if (result.error) showError(result.error);
    else setPortfolio(prev => prev.filter(w => w.id !== id));
    setBusy(null);
  }

  // ── Available work actions ───────────────────────────────────────────────

  async function toggleHide(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleHideAvailable(id, !current);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.map(w => (w.id === id ? { ...w, hide_available: !current } : w)));
    setBusy(null);
  }

  async function handleUnlist(id: string) {
    if (!confirm("Remove this work from your available listings? It won't be deleted.")) return;
    setBusy(id);
    const result = await unlistWork(id);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.filter(w => w.id !== id));
    setBusy(null);
  }

  async function handleDeleteAvailable(id: string) {
    if (!confirm("Permanently delete this work? This cannot be undone.")) return;
    setBusy(id);
    const result = await requestArtworkDeletion(id);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.filter(w => w.id !== id));
    setBusy(null);
  }

  // ── Sold work actions ────────────────────────────────────────────────────

  async function handleRemoveFromProfile(id: string) {
    setBusy(id);
    const result = await removeFromArtistProfile(id);
    if (result.error) showError(result.error);
    else setSold(prev => prev.map(w => (w.id === id ? { ...w, hidden_from_artist: true } : w)));
    setBusy(null);
  }

  async function handleRequestDeletion(id: string) {
    if (!confirm("Send a deletion request to the collector? They'll need to approve before the work is removed.")) return;
    setBusy(id);
    const result = await requestArtworkDeletion(id);
    if (result.error) { showError(result.error); setBusy(null); return; }
    if (result.conversationId) router.push(`/messages/${result.conversationId}`);
    setBusy(null);
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-xs text-destructive border border-destructive/30 px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Portfolio ── */}
      {section === "portfolio" && (
        portfolio.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No portfolio works yet. Upload below.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {portfolio.map(work => (
              <div key={work.id} className="flex items-center gap-3 py-3">
                <Thumb url={work.url} caption={work.caption} type={work.content_type} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {work.title ?? work.caption ?? "Untitled"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {work.year ?? new Date(work.created_at).getFullYear()}
                    {work.medium ? ` · ${work.medium}` : ""}
                  </p>
                </div>

                {(() => {
                  const stats = engagementMap[work.id];
                  if (!stats) return null;
                  const isMedia = work.content_type === "audio" || work.content_type === "video";
                  return (
                    <div className="hidden sm:flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                      {stats.view > 0 && <span>👁 {stats.view}</span>}
                      {isMedia && stats.play > 0 && <span>▶ {stats.play}</span>}
                    </div>
                  );
                })()}

                <div className="flex items-center gap-1.5 shrink-0">
                  {work.is_featured && <Badge>★</Badge>}
                  {work.hide_from_archive && <Badge muted>Hidden</Badge>}
                  {work.linked_artwork_id && <Badge muted>For sale</Badge>}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Star — featured toggle */}
                  <button
                    onClick={() => toggleFeatured(work.id, work.is_featured)}
                    disabled={busy === work.id}
                    title={work.is_featured ? "Remove from featured" : "Mark as featured"}
                    className={`w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-40 ${
                      work.is_featured ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill={work.is_featured ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 1l1.854 3.756L14 5.528l-3 2.924.708 4.128L8 10.57l-3.708 1.98.708-4.128L2 5.528l4.146-.772z" />
                    </svg>
                  </button>

                  {/* Edit */}
                  <Link
                    href={`/studio/works/${work.id}`}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit work"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M11.5 2.5a1.5 1.5 0 012.121 2.121l-8.5 8.5L2 14l.879-3.121 8.621-8.379z" />
                    </svg>
                  </Link>

                  {/* More menu */}
                  <MoreMenu
                    items={[
                      {
                        label: work.hide_from_archive ? "Show in archive" : "Hide from archive",
                        onClick: () => toggleHidePortfolio(work.id, work.hide_from_archive),
                        disabled: busy === work.id,
                      },
                      {
                        label: "Delete",
                        onClick: () => handleDeletePortfolio(work.id),
                        destructive: true,
                        disabled: busy === work.id,
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Available ── */}
      {section === "available" && (
        available.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No available works listed.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {available.map(work => (
              <div key={work.id} className="flex items-center gap-3 py-3">
                <Thumb url={work.url} caption={work.caption} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {work.hide_price ? "Price hidden" : (formatPrice(work.price_cents, work.price_currency, work.is_poa) ?? "—")}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {work.hide_available && <Badge muted>Hidden</Badge>}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Edit → existing artwork provenance+details page */}
                  <Link
                    href={`/studio/artworks/${work.id}`}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit work"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M11.5 2.5a1.5 1.5 0 012.121 2.121l-8.5 8.5L2 14l.879-3.121 8.621-8.379z" />
                    </svg>
                  </Link>

                  <MoreMenu
                    items={[
                      {
                        label: work.hide_available ? "Show listing" : "Hide listing",
                        onClick: () => toggleHide(work.id, work.hide_available),
                        disabled: busy === work.id,
                      },
                      {
                        label: "Remove from profile",
                        onClick: () => handleUnlist(work.id),
                        disabled: busy === work.id,
                      },
                      {
                        label: "Delete",
                        onClick: () => handleDeleteAvailable(work.id),
                        destructive: true,
                        disabled: busy === work.id,
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Sold ── */}
      {section === "sold" && (
        sold.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No transferred works yet.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {sold.map(work => (
              <div
                key={work.id}
                className={`flex items-center gap-3 py-3 ${work.hidden_from_artist ? "opacity-50" : ""}`}
              >
                <Thumb url={work.url} caption={work.caption} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(work.created_at).toLocaleDateString("en-NZ", { year: "numeric", month: "short" })}
                    {formatPrice(work.price_cents, work.price_currency, work.is_poa) ? ` · ${formatPrice(work.price_cents, work.price_currency, work.is_poa)}` : ""}
                  </p>
                  {work.ledger_id && (
                    <a href={`/provenance/${work.ledger_id}`} className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                      {work.ledger_id}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge muted>{work.hidden_from_artist ? "Hidden" : "Transferred"}</Badge>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <MoreMenu
                    items={[
                      ...(!work.hidden_from_artist ? [{
                        label: "Remove from profile",
                        onClick: () => handleRemoveFromProfile(work.id),
                        disabled: busy === work.id,
                      }] : []),
                      {
                        label: "Request deletion",
                        onClick: () => handleRequestDeletion(work.id),
                        destructive: true,
                        disabled: busy === work.id,
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Thumb({ url, caption, type }: { url: string; caption: string | null; type?: string }) {
  return (
    <div className="w-11 h-11 shrink-0 overflow-hidden bg-muted border border-border">
      {!type || type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={caption ?? ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{type}</span>
        </div>
      )}
    </div>
  );
}

function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 leading-none border ${muted ? "border-border text-muted-foreground" : "border-black font-medium"}`}>
      {children}
    </span>
  );
}
