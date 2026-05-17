"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { GripVertical, X, Plus, ExternalLink } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import {
  updateSeries,
  syncSeriesArtworks,
  getArtistArtworksForPicker,
  addExistingArtworkToSeries,
} from "@/app/studio/series/actions";
import { createAdminArtworkInSeries } from "@/app/studio/series/editor-actions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const MAX_PX = 1600;
const QUALITY = 0.88;

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function compressToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/webp",
        QUALITY
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

async function uploadToStorage(profileId: string, blob: Blob, prefix: string): Promise<string> {
  const supabase = getSupabase();
  const path = `${prefix}/${profileId}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const { error } = await supabase.storage
    .from("portfolio")
    .upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
  return publicUrl;
}

export interface SeriesArtworkRow {
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
  medium: string | null;
  year: number | null;
  slug: string | null;
  is_available: boolean;
  price_cents: number | null;
  is_poa: boolean;
  price_currency: string;
  position: number;
  uploading?: boolean;
  uploadError?: string;
}

interface PickerArtwork {
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
}

interface SeriesData {
  id: string;
  title: string;
  slug: string;
  hero_image_url: string | null;
  description: string | null;
}

function SortableArtworkCard({
  artwork,
  onRemove,
}: {
  artwork: SeriesArtworkRow;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: artwork.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const displayName = artwork.title ?? artwork.caption ?? "Untitled";
  const priceDisplay = artwork.is_poa
    ? "POA"
    : artwork.price_cents
    ? `${artwork.price_currency} ${(artwork.price_cents / 100).toLocaleString()}`
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-border bg-background flex gap-3 p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing mt-1"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      <div className="w-16 h-16 shrink-0 bg-muted border border-border overflow-hidden">
        {artwork.uploading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artwork.url} alt={displayName} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {artwork.uploadError && (
          <p className="text-xs text-destructive mb-1">{artwork.uploadError}</p>
        )}
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground">
          {[artwork.medium, artwork.year].filter(Boolean).join(" · ")}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {artwork.is_available ? (
            <span className="text-[10px] font-medium bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-sm">
              {priceDisplay ?? "For sale"}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">Archival</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/studio/works/${artwork.id}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Open in work editor"
        >
          <ExternalLink size={13} />
        </Link>
        <button
          onClick={onRemove}
          className="text-stone-300 hover:text-destructive transition-colors"
          aria-label="Remove from series"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

interface Props {
  profileId: string;
  artistUsername: string;
  series: SeriesData;
  initialArtworks: SeriesArtworkRow[];
}

export function SeriesEditorClient({ profileId, artistUsername, series, initialArtworks }: Props) {
  const [artworks, setArtworks] = useState<SeriesArtworkRow[]>(initialArtworks);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const [heroUrl, setHeroUrl] = useState<string | null>(series.hero_image_url);
  const [heroUploading, setHeroUploading] = useState(false);

  const [title, setTitle] = useState(series.title);
  const [titleSaving, setTitleSaving] = useState(false);
  const [description, setDescription] = useState(series.description ?? "");
  const [descSaving, setDescSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerWorks, setPickerWorks] = useState<PickerArtwork[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const heroInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  // --- Hero ---
  async function handleHeroDrop(file: File) {
    setHeroUploading(true);
    setError(null);
    try {
      const blob = await compressToWebp(file);
      const url = await uploadToStorage(profileId, blob, "series-heroes");
      setHeroUrl(url);
      const result = await updateSeries(series.id, { hero_image_url: url });
      if (result.error) setError(result.error);
      else flash("Hero image updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hero upload failed");
    }
    setHeroUploading(false);
  }

  // --- Title ---
  async function handleTitleBlur() {
    if (title.trim() === series.title) return;
    if (!title.trim()) { setTitle(series.title); return; }
    setTitleSaving(true);
    const result = await updateSeries(series.id, { title: title.trim() });
    if (result.error) setError(result.error);
    else flash("Title saved.");
    setTitleSaving(false);
  }

  // --- Description ---
  async function handleDescBlur() {
    const val = description.trim() || null;
    if (val === (series.description ?? null)) return;
    setDescSaving(true);
    const result = await updateSeries(series.id, { description: val });
    if (result.error) setError(result.error);
    else flash("Description saved.");
    setDescSaving(false);
  }

  // --- Drag & drop order ---
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setArtworks(prev => {
        const oldIndex = prev.findIndex(a => a.id === active.id);
        const newIndex = prev.findIndex(a => a.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setOrderDirty(true);
    }
  }

  async function saveOrder() {
    setSavingOrder(true);
    setError(null);
    const result = await syncSeriesArtworks(series.id, artworks.map(a => a.id));
    if (result.error) setError(result.error);
    else { setOrderDirty(false); flash("Order saved."); }
    setSavingOrder(false);
  }

  // --- Remove artwork ---
  async function removeArtwork(artworkId: string) {
    const remaining = artworks.filter(a => a.id !== artworkId);
    setArtworks(remaining);
    const result = await syncSeriesArtworks(series.id, remaining.map(a => a.id));
    if (result.error) {
      setError(result.error);
      setArtworks(artworks); // revert
    }
  }

  // --- Upload new artwork images ---
  async function handleArtworkFiles(files: FileList) {
    const placeholders: SeriesArtworkRow[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      url: "",
      caption: file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
      title: null,
      medium: null,
      year: null,
      slug: null,
      is_available: false,
      price_cents: null,
      is_poa: false,
      price_currency: "NZD",
      position: artworks.length,
      uploading: true,
    }));

    setArtworks(prev => [...prev, ...placeholders]);

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const placeholder = placeholders[i];
        try {
          const blob = await compressToWebp(file);
          const uploadedUrl = await uploadToStorage(profileId, blob, "series-artworks");
          // Create artwork row + add to series
          const result = await createAdminArtworkInSeries({
            seriesId: series.id,
            uploadedUrl,
            caption: placeholder.caption ?? "",
            position: (artworks.length + i),
          });
          if (result.error || !result.artworkId) {
            setArtworks(prev => prev.map(a => a.id === placeholder.id
              ? { ...a, uploading: false, uploadError: result.error ?? "Failed to save" }
              : a
            ));
          } else {
            setArtworks(prev => prev.map(a => a.id === placeholder.id
              ? { ...a, id: result.artworkId!, url: uploadedUrl, uploading: false }
              : a
            ));
          }
        } catch (e) {
          setArtworks(prev => prev.map(a => a.id === placeholder.id
            ? { ...a, uploading: false, uploadError: e instanceof Error ? e.message : "Upload failed" }
            : a
          ));
        }
      })
    );
  }

  // --- Existing picker ---
  async function openPicker() {
    setPickerOpen(true);
    if (pickerWorks.length === 0) {
      setPickerLoading(true);
      const works = await getArtistArtworksForPicker();
      setPickerWorks(works);
      setPickerLoading(false);
    }
  }

  async function addExisting(work: PickerArtwork) {
    setPickerOpen(false);
    const result = await addExistingArtworkToSeries(series.id, work.id);
    if (result.error) { setError(result.error); return; }
    setArtworks(prev => [...prev, {
      id: work.id,
      url: work.url,
      caption: work.caption,
      title: work.title,
      medium: null,
      year: null,
      slug: null,
      is_available: false,
      price_cents: null,
      is_poa: false,
      price_currency: "NZD",
      position: prev.length,
    }]);
    flash("Artwork added.");
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const handleArtworkDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleArtworkFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, artworks.length]);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Breadcrumb */}
      <div className="space-y-0.5">
        <Link href="/studio?section=works&wt=series" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Works / Series
        </Link>
        <h1 className="text-xl font-semibold">Edit Series</h1>
      </div>

      {error && <p className="text-xs text-destructive border border-destructive/30 px-3 py-2">{error}</p>}
      {successMsg && <p className="text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 px-3 py-2">{successMsg}</p>}

      {/* Hero */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Hero image</p>
        <div
          className="relative border border-dashed border-border hover:border-stone-400 transition-colors cursor-pointer"
          style={{ height: 200 }}
          onClick={() => heroInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleHeroDrop(f); }}
        >
          {heroUploading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            </div>
          ) : heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt="Hero" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Drop image or click to upload</p>
            </div>
          )}
          <input
            ref={heroInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeroDrop(f); }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">Drop a new image to replace the hero. Saved immediately.</p>
      </div>

      {/* Title + description */}
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Title {titleSaving && <span className="normal-case font-normal text-stone-400">saving…</span>}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-sm border-b border-border focus:border-foreground focus:outline-none pb-1 bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Description{" "}
            <span className="normal-case font-normal">(optional)</span>
            {descSaving && <span className="ml-1 normal-case font-normal text-stone-400">saving…</span>}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescBlur}
            placeholder="A few sentences about this series…"
            rows={3}
            className="w-full text-sm border border-border focus:border-foreground focus:outline-none p-2 bg-transparent resize-none"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">Title and description auto-save when you click away.</p>
      </div>

      {/* Artworks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Artworks ({artworks.length})
          </p>
          {orderDirty && (
            <button
              onClick={saveOrder}
              disabled={savingOrder}
              className="text-xs bg-black text-white px-3 py-1 hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {savingOrder ? "Saving…" : "Save order"}
            </button>
          )}
        </div>

        {artworks.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={artworks.map(a => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {artworks.map(artwork => (
                  <SortableArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    onRemove={() => removeArtwork(artwork.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Drop zone */}
        <div
          className="border border-dashed border-border hover:border-stone-400 transition-colors p-6 text-center cursor-pointer"
          onClick={() => artworkInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleArtworkDrop}
        >
          <p className="text-xs text-muted-foreground">Drop artwork images here or click to upload</p>
          <p className="text-[10px] text-stone-400 mt-1">Multiple files supported</p>
          <input
            ref={artworkInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => { if (e.target.files?.length) handleArtworkFiles(e.target.files); }}
          />
        </div>

        <button
          type="button"
          onClick={openPicker}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus size={13} />
          Add existing artwork from your catalogue
        </button>
      </div>

      {/* Public link */}
      <div className="pt-4 border-t border-border">
        <Link
          href={`/${artistUsername}/series/${series.slug}`}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          target="_blank"
        >
          View public series page →
        </Link>
      </div>

      {/* Picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPickerOpen(false)}>
          <div className="bg-background w-full max-w-lg max-h-[80vh] overflow-y-auto m-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add from catalogue</h2>
              <button onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            {pickerLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : pickerWorks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No artworks found.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {pickerWorks.map(work => {
                  const added = artworks.some(a => a.id === work.id);
                  return (
                    <button
                      key={work.id}
                      onClick={() => !added && addExisting(work)}
                      disabled={added}
                      className={`relative aspect-square overflow-hidden border transition-colors ${added ? "border-black opacity-50" : "border-border hover:border-stone-400"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={work.url} alt={work.caption ?? ""} className="w-full h-full object-cover" />
                      {added && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="text-white text-xs font-medium">Added</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
