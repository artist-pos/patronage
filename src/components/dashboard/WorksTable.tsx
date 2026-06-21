"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  toggleFeaturedWork,
  toggleHidePortfolioWork,
  toggleHideAvailable,
  deletePortfolioWork,
  unlistWork,
  archiveWork,
  reorderMixedArchivalItems,
} from "@/app/profile/available-work-actions";
import { toggleSeriesFeatured } from "@/app/studio/series/actions";
import {
  requestArtworkDeletion,
  removeFromArtistProfile,
} from "@/app/profile/artwork-delete-actions";
import { formatPrice } from "@/lib/format-price";

interface SeriesRow {
  _kind: "series";
  id: string;
  title: string;
  hero_image_url: string | null;
  artworkCount: number;
  is_featured: boolean;
  position: number;
}

interface PortfolioRow {
  id: string;
  url: string;
  caption: string | null;
  description: string | null;
  title: string | null;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  is_available: boolean;
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
  is_featured: boolean;
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

export type { SeriesRow };

interface Props {
  section: "portfolio" | "available" | "sold";
  portfolioWorks: (PortfolioRow | SeriesRow)[];
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

function SortablePortfolioRow({
  work,
  busy,
  featuredCount,
  engagementMap,
  onToggleFeatured,
  onToggleHide,
  onDelete,
}: {
  work: PortfolioRow;
  busy: string | null;
  featuredCount: number;
  engagementMap: Record<string, { view: number; play: number }>;
  onToggleFeatured: (id: string, current: boolean) => void;
  onToggleHide: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: work.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const stats = engagementMap[work.id];
  const isMedia = work.content_type === "audio" || work.content_type === "video";

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 py-3">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="w-5 h-7 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Drag to reorder"
      >
        <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5" /><circle cx="7" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" /><circle cx="7" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" /><circle cx="7" cy="13" r="1.5" />
        </svg>
      </button>

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

      {stats && (
        <div className="hidden sm:flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
          {stats.view > 0 && <span>👁 {stats.view}</span>}
          {isMedia && stats.play > 0 && <span>▶ {stats.play}</span>}
        </div>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        {work.is_featured && <Badge>★</Badge>}
        {work.hide_from_archive && <Badge muted>Hidden</Badge>}
        {work.is_available && <Badge muted>For sale</Badge>}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleFeatured(work.id, work.is_featured)}
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
        <Link
          href={`/studio/works/${work.id}`}
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
              label: work.hide_from_archive ? "Show in archive" : "Hide from archive",
              onClick: () => onToggleHide(work.id, work.hide_from_archive),
              disabled: busy === work.id,
            },
            {
              label: "Delete",
              onClick: () => onDelete(work.id),
              destructive: true,
              disabled: busy === work.id,
            },
          ]}
        />
      </div>
    </div>
  );
}

function isSeries(item: PortfolioRow | SeriesRow): item is SeriesRow {
  return "_kind" in item && item._kind === "series";
}

function SortableSeriesRow({
  series,
  busy,
  onToggleFeatured,
}: {
  series: SeriesRow;
  busy: string | null;
  onToggleFeatured: (id: string, current: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: series.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 py-3">
      <button
        {...attributes}
        {...listeners}
        className="w-5 h-7 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Drag to reorder"
      >
        <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5" /><circle cx="7" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" /><circle cx="7" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" /><circle cx="7" cy="13" r="1.5" />
        </svg>
      </button>

      <div className="w-11 h-11 shrink-0 overflow-hidden bg-muted border border-border">
        {series.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={series.hero_image_url} alt={series.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-stone-200" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{series.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {series.artworkCount} {series.artworkCount === 1 ? "work" : "works"}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {series.is_featured && <Badge>★</Badge>}
        <span className="text-[10px] px-1.5 py-0.5 leading-none border border-stone-300 text-stone-500">Series</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleFeatured(series.id, series.is_featured)}
          disabled={busy === series.id}
          title={series.is_featured ? "Remove from featured" : "Mark as featured"}
          className={`w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-40 ${
            series.is_featured ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill={series.is_featured ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1l1.854 3.756L14 5.528l-3 2.924.708 4.128L8 10.57l-3.708 1.98.708-4.128L2 5.528l4.146-.772z" />
          </svg>
        </button>
        <Link
          href={`/studio/series/${series.id}`}
          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Edit series"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 2.5a1.5 1.5 0 012.121 2.121l-8.5 8.5L2 14l.879-3.121 8.621-8.379z" />
          </svg>
        </Link>
      </div>
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
  const [portfolio, setPortfolio] = useState<(PortfolioRow | SeriesRow)[]>(portfolioWorks);
  const [available, setAvailable] = useState<AvailableRow[]>(availableWorks);
  const [sold, setSold] = useState<SoldRow[]>(soldWorks);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = portfolio.findIndex(w => w.id === active.id);
    const newIndex = portfolio.findIndex(w => w.id === over.id);
    const reordered = arrayMove(portfolio, oldIndex, newIndex);
    setPortfolio(reordered);
    await reorderMixedArchivalItems(reordered.map(item => ({
      id: item.id,
      kind: isSeries(item) ? "series" as const : "artwork" as const,
    })));
  }

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  // ── Portfolio actions ────────────────────────────────────────────────────

  async function toggleFeatured(id: string, current: boolean) {
    setBusy(id);
    const item = portfolio.find(w => w.id === id);
    let result: { error?: string };
    if (item && isSeries(item)) {
      result = await toggleSeriesFeatured(id, !current);
    } else {
      result = await toggleFeaturedWork(id, !current, featuredCount);
    }
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

  async function toggleFeaturedAvailable(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleFeaturedWork(id, !current, featuredCount);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.map(w => (w.id === id ? { ...w, is_featured: !current } : w)));
    setBusy(null);
  }

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

  async function handleArchiveAvailable(id: string) {
    if (!confirm("Archive this work? It will be removed from your listings and archive, but provenance records are preserved.")) return;
    setBusy(id);
    const result = await archiveWork(id);
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={portfolio.map(w => w.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border border-t border-border">
                {portfolio.map(item => (
                  isSeries(item) ? (
                    <SortableSeriesRow
                      key={item.id}
                      series={item}
                      busy={busy}
                      onToggleFeatured={toggleFeatured}
                    />
                  ) : (
                    <SortablePortfolioRow
                      key={item.id}
                      work={item}
                      busy={busy}
                      featuredCount={featuredCount}
                      engagementMap={engagementMap}
                      onToggleFeatured={toggleFeatured}
                      onToggleHide={toggleHidePortfolio}
                      onDelete={handleDeletePortfolio}
                    />
                  )
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
                  {work.is_featured && <Badge>★</Badge>}
                  {work.hide_available && <Badge muted>Hidden</Badge>}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Feature */}
                  <button
                    onClick={() => toggleFeaturedAvailable(work.id, work.is_featured)}
                    disabled={busy === work.id}
                    title={work.is_featured ? "Remove from featured" : "Feature on profile (stays for sale)"}
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
                        label: "Archive",
                        onClick: () => handleArchiveAvailable(work.id),
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
