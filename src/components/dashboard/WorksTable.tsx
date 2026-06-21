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
  rectSortingStrategy,
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
  reorderWorks,
} from "@/app/profile/available-work-actions";
import { toggleSeriesFeatured } from "@/app/studio/series/actions";
import {
  requestArtworkDeletion,
  removeFromArtistProfile,
} from "@/app/profile/artwork-delete-actions";
import { formatPrice } from "@/lib/format-price";

// ── Types ───────────────────────────────────────────────────────────────────

export type WorkStatus = "archival" | "for-sale" | "sold";
export type WorksFilter = "all" | "for-sale" | "sold" | "featured" | "archival";

export interface WorkItem {
  id: string;
  url: string;
  caption: string | null;
  description?: string | null;
  title: string | null;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  content_type: string;
  price_cents: number | null;
  is_poa: boolean;
  price_currency: string;
  is_available: boolean;
  is_featured: boolean;
  hide_available: boolean;
  hide_price: boolean;
  hide_from_archive: boolean;
  position: number;
  created_at: string;
  current_owner_id: string;
  hidden_from_artist: boolean;
  ledger_id?: string | null;
  status: WorkStatus;
}

export interface SeriesRow {
  _kind: "series";
  id: string;
  title: string;
  hero_image_url: string | null;
  artworkCount: number;
  is_featured: boolean;
  position: number;
}

type MergedItem = WorkItem | SeriesRow;

function isSeries(item: MergedItem): item is SeriesRow {
  return "_kind" in item && item._kind === "series";
}

const MAX_FEATURED = 8;

const STATUS_LABEL: Record<WorkStatus | "series", string> = {
  archival: "Archival",
  "for-sale": "For sale",
  sold: "Sold",
  series: "Series",
};

function byPosition(a: MergedItem, b: MergedItem) {
  return (a.position ?? 9999) - (b.position ?? 9999);
}

function matchesFilter(item: MergedItem, filter: WorksFilter): boolean {
  switch (filter) {
    case "all":      return true;
    case "featured": return item.is_featured;
    case "archival": return isSeries(item) || item.status === "archival";
    case "for-sale": return !isSeries(item) && item.status === "for-sale";
    case "sold":     return !isSeries(item) && item.status === "sold";
  }
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function useOutsideClick(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

interface MenuItem { label: string; onClick: () => void; destructive?: boolean; disabled?: boolean }

function MoreMenu({ items, align = "right" }: { items: MenuItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  if (items.length === 0) return null;

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
        <div className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1 bg-background border border-border shadow-md z-50 py-1 min-w-[160px]`}>
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); setOpen(false); }}
              disabled={item.disabled}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                item.destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted/60"
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

function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 leading-none border ${muted ? "border-border text-muted-foreground" : "border-black font-medium"}`}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: WorkStatus | "series" }) {
  const tone =
    status === "for-sale" ? "bg-stone-900 text-white border-stone-900"
    : status === "sold"   ? "bg-stone-100 text-stone-500 border-stone-200"
    : "bg-stone-100 text-stone-600 border-stone-200";
  return (
    <span className={`text-[10px] px-2 py-0.5 leading-none rounded-full border ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Thumb({ url, caption, type, size = "sm" }: { url: string | null; caption: string | null; type?: string; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "w-full aspect-square" : "w-11 h-11";
  return (
    <div className={`${box} shrink-0 overflow-hidden bg-muted border border-border`}>
      {url && (!type || type === "image") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={caption ?? ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{type ?? "—"}</span>
        </div>
      )}
    </div>
  );
}

function DragHandle({ listeners, attributes, className = "" }: { listeners: ReturnType<typeof useSortable>["listeners"]; attributes: ReturnType<typeof useSortable>["attributes"]; className?: string }) {
  return (
    <button
      {...attributes}
      {...listeners}
      className={`flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing ${className}`}
      aria-label="Drag to reorder"
    >
      <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="3" cy="3" r="1.5" /><circle cx="7" cy="3" r="1.5" />
        <circle cx="3" cy="8" r="1.5" /><circle cx="7" cy="8" r="1.5" />
        <circle cx="3" cy="13" r="1.5" /><circle cx="7" cy="13" r="1.5" />
      </svg>
    </button>
  );
}

function StarButton({ active, disabled, onClick }: { active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={active ? "Remove from featured" : "Feature on profile"}
      className={`w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-40 ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1l1.854 3.756L14 5.528l-3 2.924.708 4.128L8 10.57l-3.708 1.98.708-4.128L2 5.528l4.146-.772z" />
      </svg>
    </button>
  );
}

function EditLink({ href }: { href: string }) {
  return (
    <Link href={href} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Edit">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.5 2.5a1.5 1.5 0 012.121 2.121l-8.5 8.5L2 14l.879-3.121 8.621-8.379z" />
      </svg>
    </Link>
  );
}

// ── Per-item action wiring ────────────────────────────────────────────────────

interface ItemHandlers {
  onToggleFeatured: (item: MergedItem) => void;
  onToggleHideArchive: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
  onToggleHideListing: (item: WorkItem) => void;
  onUnlist: (item: WorkItem) => void;
  onArchive: (item: WorkItem) => void;
  onRemoveFromProfile: (item: WorkItem) => void;
  onRequestDeletion: (item: WorkItem) => void;
}

function editHref(item: MergedItem): string | null {
  if (isSeries(item)) return `/studio/series/${item.id}`;
  if (item.status === "sold") return null;
  return `/studio/works/${item.id}`;
}

function menuItemsFor(item: MergedItem, busy: boolean, h: ItemHandlers): MenuItem[] {
  if (isSeries(item)) return [];
  const d = busy;
  if (item.status === "archival") {
    return [
      { label: item.hide_from_archive ? "Show in archive" : "Hide from archive", onClick: () => h.onToggleHideArchive(item), disabled: d },
      { label: "Delete", onClick: () => h.onDelete(item), destructive: true, disabled: d },
    ];
  }
  if (item.status === "for-sale") {
    return [
      { label: item.hide_available ? "Show listing" : "Hide listing", onClick: () => h.onToggleHideListing(item), disabled: d },
      { label: "Remove from profile", onClick: () => h.onUnlist(item), disabled: d },
      { label: "Archive", onClick: () => h.onArchive(item), destructive: true, disabled: d },
    ];
  }
  // sold
  return [
    ...(!item.hidden_from_artist ? [{ label: "Remove from profile", onClick: () => h.onRemoveFromProfile(item), disabled: d }] : []),
    { label: "Request deletion", onClick: () => h.onRequestDeletion(item), destructive: true, disabled: d },
  ];
}

function secondaryLine(item: MergedItem): string {
  if (isSeries(item)) return `${item.artworkCount} ${item.artworkCount === 1 ? "work" : "work"}s`;
  if (item.status === "for-sale") {
    return item.hide_price ? "Price hidden" : (formatPrice(item.price_cents, item.price_currency, item.is_poa) ?? "—");
  }
  if (item.status === "sold") {
    const date = new Date(item.created_at).toLocaleDateString("en-NZ", { year: "numeric", month: "short" });
    const price = formatPrice(item.price_cents, item.price_currency, item.is_poa);
    return price ? `${date} · ${price}` : date;
  }
  return `${item.year ?? new Date(item.created_at).getFullYear()}${item.medium ? ` · ${item.medium}` : ""}`;
}

// ── Sortable item (list row + grid tile) ──────────────────────────────────────

function SortableItem({
  item, view, draggable, busy, stats, handlers,
}: {
  item: MergedItem;
  view: "list" | "grid";
  draggable: boolean;
  busy: boolean;
  stats?: { view: number; play: number };
  handlers: ItemHandlers;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !draggable });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const status: WorkStatus | "series" = isSeries(item) ? "series" : item.status;
  const title = isSeries(item) ? item.title : (item.title ?? item.caption ?? "Untitled");
  const thumbUrl = isSeries(item) ? item.hero_image_url : item.url;
  const thumbType = isSeries(item) ? "image" : item.content_type;
  const dimmed = !isSeries(item) && item.status === "sold" && item.hidden_from_artist;
  const href = editHref(item);
  const menu = menuItemsFor(item, busy, handlers);
  const provenanceHref = !isSeries(item) && item.status === "sold" && item.ledger_id ? `/provenance/${item.ledger_id}` : null;
  const isMedia = !isSeries(item) && (item.content_type === "audio" || item.content_type === "video");

  const actions = (
    <>
      <StarButton active={item.is_featured} disabled={busy} onClick={() => handlers.onToggleFeatured(item)} />
      {href && <EditLink href={href} />}
      <MoreMenu items={menu} />
    </>
  );

  const pills = (
    <>
      <StatusPill status={status} />
      {item.is_featured && <Badge>★</Badge>}
      {!isSeries(item) && item.hide_from_archive && item.status !== "for-sale" && <Badge muted>Hidden</Badge>}
      {!isSeries(item) && item.hide_available && item.status === "for-sale" && <Badge muted>Hidden</Badge>}
      {dimmed && <Badge muted>Hidden</Badge>}
    </>
  );

  if (view === "grid") {
    return (
      <div ref={setNodeRef} style={style} className={`relative group border border-border bg-background ${dimmed ? "opacity-50" : ""}`}>
        <Thumb url={thumbUrl} caption={title} type={thumbType} size="lg" />
        {draggable && (
          <DragHandle listeners={listeners} attributes={attributes}
            className="absolute top-1 left-1 w-6 h-6 bg-background/80 backdrop-blur border border-border opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-background/80 backdrop-blur border border-border opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
        <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 flex-wrap">{pills}</div>
        <div className="p-2">
          <p className="text-xs font-medium truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{secondaryLine(item)}</p>
        </div>
      </div>
    );
  }

  // list view
  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 py-3 ${dimmed ? "opacity-50" : ""}`}>
      {draggable
        ? <DragHandle listeners={listeners} attributes={attributes} className="w-5 h-7 shrink-0" />
        : <span className="w-5 shrink-0" />}
      <Thumb url={thumbUrl} caption={title} type={thumbType} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{secondaryLine(item)}</p>
        {provenanceHref && (
          <a href={provenanceHref} className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
            {(item as WorkItem).ledger_id}
          </a>
        )}
      </div>
      {stats && (
        <div className="hidden sm:flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
          {stats.view > 0 && <span>👁 {stats.view}</span>}
          {isMedia && stats.play > 0 && <span>▶ {stats.play}</span>}
        </div>
      )}
      <div className="flex items-center gap-1.5 shrink-0">{pills}</div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
    </div>
  );
}

// ── Manager ───────────────────────────────────────────────────────────────────

interface Props {
  works: WorkItem[];
  seriesItems: SeriesRow[];
  featuredCount: number;
  engagementMap?: Record<string, { view: number; play: number }>;
  filter: WorksFilter;
  view: "list" | "grid";
}

export function WorksManager({ works, seriesItems, engagementMap = {}, filter, view }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<MergedItem[]>(() => [...seriesItems, ...works].sort(byPosition));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const featuredCount = items.filter(i => i.is_featured).length;
  const draggable = filter === "all";
  const displayed = items.filter(i => matchesFilter(i, filter));

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    const result = await reorderWorks(reordered.map(i => ({ id: i.id, kind: isSeries(i) ? "series" as const : "artwork" as const })));
    if (result.error) showError(result.error);
  }

  function patch(id: string, updates: Partial<WorkItem>) {
    setItems(prev => prev.map(i => (i.id === id && !isSeries(i) ? { ...i, ...updates } : i)));
  }

  const handlers: ItemHandlers = {
    onToggleFeatured: async (item) => {
      const current = item.is_featured;
      if (!current && featuredCount >= MAX_FEATURED) {
        showError(`You can feature up to ${MAX_FEATURED} works. Unfeature one first.`);
        return;
      }
      setBusy(item.id);
      const result = isSeries(item)
        ? await toggleSeriesFeatured(item.id, !current)
        : await toggleFeaturedWork(item.id, !current, featuredCount);
      if (result.error) showError(result.error);
      else setItems(prev => prev.map(i => (i.id === item.id ? { ...i, is_featured: !current } : i)));
      setBusy(null);
    },
    onToggleHideArchive: async (item) => {
      setBusy(item.id);
      const result = await toggleHidePortfolioWork(item.id, !item.hide_from_archive);
      if (result.error) showError(result.error);
      else patch(item.id, { hide_from_archive: !item.hide_from_archive });
      setBusy(null);
    },
    onDelete: async (item) => {
      if (!confirm("Permanently delete this work? This cannot be undone.")) return;
      setBusy(item.id);
      const result = await deletePortfolioWork(item.id);
      if (result.error) showError(result.error);
      else setItems(prev => prev.filter(i => i.id !== item.id));
      setBusy(null);
    },
    onToggleHideListing: async (item) => {
      setBusy(item.id);
      const result = await toggleHideAvailable(item.id, !item.hide_available);
      if (result.error) showError(result.error);
      else patch(item.id, { hide_available: !item.hide_available });
      setBusy(null);
    },
    onUnlist: async (item) => {
      if (!confirm("Remove this work from your available listings? It will move to Archival, not be deleted.")) return;
      setBusy(item.id);
      const result = await unlistWork(item.id);
      if (result.error) showError(result.error);
      else patch(item.id, { is_available: false, status: "archival" });
      setBusy(null);
    },
    onArchive: async (item) => {
      if (!confirm("Archive this work? It will move to Archival and be hidden from your profile, but provenance records are preserved.")) return;
      setBusy(item.id);
      const result = await archiveWork(item.id);
      if (result.error) showError(result.error);
      else patch(item.id, { is_available: false, hide_from_archive: true, status: "archival" });
      setBusy(null);
    },
    onRemoveFromProfile: async (item) => {
      setBusy(item.id);
      const result = await removeFromArtistProfile(item.id);
      if (result.error) showError(result.error);
      else patch(item.id, { hidden_from_artist: true });
      setBusy(null);
    },
    onRequestDeletion: async (item) => {
      if (!confirm("Send a deletion request to the collector? They'll need to approve before the work is removed.")) return;
      setBusy(item.id);
      const result = await requestArtworkDeletion(item.id);
      if (result.error) { showError(result.error); setBusy(null); return; }
      if (result.conversationId) router.push(`/messages/${result.conversationId}`);
      setBusy(null);
    },
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-destructive border border-destructive/30 px-3 py-2">{error}</div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span><span className="font-semibold text-foreground">{featuredCount}</span> of {MAX_FEATURED} works featured — shown on your profile overview</span>
        {!draggable && <span className="italic">Switch to “All” to drag‑reorder</span>}
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">No works match this filter.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayed.map(i => i.id)} strategy={view === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
            {view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayed.map(item => (
                  <SortableItem key={item.id} item={item} view="grid" draggable={draggable}
                    busy={busy === item.id} stats={engagementMap[item.id]} handlers={handlers} />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border border-t border-border">
                {displayed.map(item => (
                  <SortableItem key={item.id} item={item} view="list" draggable={draggable}
                    busy={busy === item.id} stats={engagementMap[item.id]} handlers={handlers} />
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
