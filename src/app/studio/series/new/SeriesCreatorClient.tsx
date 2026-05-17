"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GripVertical, X, Plus } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { createSeries, getArtistArtworksForPicker } from "@/app/studio/series/actions";
import type { ArtworkStubInput } from "@/app/studio/series/actions";
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

interface ArtworkStub {
  stubId: string;
  existingId?: string;
  uploadedUrl?: string;
  uploading: boolean;
  uploadError?: string;
  caption: string;
  medium: string;
  year: string;
  forSale: boolean;
  price: string;
  currency: "NZD" | "AUD";
  is_poa: boolean;
}

interface PickerArtwork {
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
}

function SortableStubCard({
  stub,
  onChange,
  onRemove,
}: {
  stub: ArtworkStub;
  onChange: (updates: Partial<ArtworkStub>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stub.stubId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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

      {/* Thumbnail */}
      <div className="w-16 h-16 shrink-0 bg-muted border border-border overflow-hidden">
        {stub.uploading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          </div>
        ) : stub.uploadedUrl || stub.existingId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stub.uploadedUrl ?? ""}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-stone-100" />
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 min-w-0 space-y-2">
        {stub.uploadError && (
          <p className="text-xs text-destructive">{stub.uploadError}</p>
        )}
        <input
          type="text"
          placeholder="Title / caption"
          value={stub.caption}
          onChange={(e) => onChange({ caption: e.target.value })}
          className="w-full text-sm border-0 border-b border-border focus:border-foreground focus:outline-none pb-0.5 bg-transparent"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Medium"
            value={stub.medium}
            onChange={(e) => onChange({ medium: e.target.value })}
            className="flex-1 text-xs border-0 border-b border-border focus:border-foreground focus:outline-none pb-0.5 bg-transparent"
          />
          <input
            type="number"
            placeholder="Year"
            value={stub.year}
            onChange={(e) => onChange({ year: e.target.value })}
            className="w-16 text-xs border-0 border-b border-border focus:border-foreground focus:outline-none pb-0.5 bg-transparent"
          />
        </div>

        {/* For sale toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={stub.forSale}
            onClick={() => onChange({ forSale: !stub.forSale })}
            className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors ${stub.forSale ? "bg-black" : "bg-stone-200"}`}
          >
            <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${stub.forSale ? "translate-x-3" : "translate-x-0"}`} />
          </button>
          <span className="text-xs text-muted-foreground">For sale</span>
        </div>

        {stub.forSale && (
          <div className="flex items-center gap-2">
            <select
              value={stub.currency}
              onChange={(e) => onChange({ currency: e.target.value as "NZD" | "AUD" })}
              className="text-xs border border-border rounded px-1.5 py-0.5 bg-white focus:outline-none"
            >
              <option value="NZD">NZD</option>
              <option value="AUD">AUD</option>
            </select>
            <input
              type="number"
              placeholder="Price"
              value={stub.price}
              onChange={(e) => onChange({ price: e.target.value })}
              disabled={stub.is_poa}
              className="w-24 text-xs border-0 border-b border-border focus:border-foreground focus:outline-none pb-0.5 bg-transparent disabled:opacity-40"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={stub.is_poa}
                onChange={(e) => onChange({ is_poa: e.target.checked })}
              />
              POA
            </label>
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 text-stone-300 hover:text-destructive transition-colors"
        aria-label="Remove"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface Props {
  profileId: string;
}

export function SeriesCreatorClient({ profileId }: Props) {
  const router = useRouter();

  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stubs, setStubs] = useState<ArtworkStub[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerWorks, setPickerWorks] = useState<PickerArtwork[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const heroInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleHeroDrop(file: File) {
    setHeroUploading(true);
    try {
      const blob = await compressToWebp(file);
      const url = await uploadToStorage(profileId, blob, "series-heroes");
      setHeroUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hero upload failed");
    }
    setHeroUploading(false);
  }

  async function handleArtworkFiles(files: FileList) {
    const newStubs: ArtworkStub[] = Array.from(files).map(file => ({
      stubId: crypto.randomUUID(),
      uploading: true,
      caption: file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
      medium: "",
      year: new Date().getFullYear().toString(),
      forSale: false,
      price: "",
      currency: "NZD",
      is_poa: false,
    }));

    setStubs(prev => [...prev, ...newStubs]);

    // Upload each concurrently
    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const stubId = newStubs[i].stubId;
        try {
          const blob = await compressToWebp(file);
          const url = await uploadToStorage(profileId, blob, "series-artworks");
          setStubs(prev => prev.map(s => s.stubId === stubId
            ? { ...s, uploading: false, uploadedUrl: url }
            : s
          ));
        } catch (e) {
          setStubs(prev => prev.map(s => s.stubId === stubId
            ? { ...s, uploading: false, uploadError: e instanceof Error ? e.message : "Upload failed" }
            : s
          ));
        }
      })
    );
  }

  function updateStub(stubId: string, updates: Partial<ArtworkStub>) {
    setStubs(prev => prev.map(s => s.stubId === stubId ? { ...s, ...updates } : s));
  }

  function removeStub(stubId: string) {
    setStubs(prev => prev.filter(s => s.stubId !== stubId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStubs(prev => {
        const oldIndex = prev.findIndex(s => s.stubId === active.id);
        const newIndex = prev.findIndex(s => s.stubId === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  async function openPicker() {
    setPickerOpen(true);
    if (pickerWorks.length === 0) {
      setPickerLoading(true);
      const works = await getArtistArtworksForPicker();
      setPickerWorks(works);
      setPickerLoading(false);
    }
  }

  function addExistingArtwork(work: PickerArtwork) {
    const alreadyAdded = stubs.some(s => s.existingId === work.id);
    if (alreadyAdded) return;
    setStubs(prev => [...prev, {
      stubId: crypto.randomUUID(),
      existingId: work.id,
      uploadedUrl: work.url,
      uploading: false,
      caption: work.title ?? work.caption ?? "",
      medium: "",
      year: "",
      forSale: false,
      price: "",
      currency: "NZD",
      is_poa: false,
    }]);
  }

  async function handleSubmit() {
    if (!heroUrl) { setError("Add a hero image for the series."); return; }
    if (!title.trim()) { setError("Give the series a title."); return; }
    if (stubs.length === 0) { setError("Add at least one artwork."); return; }
    if (stubs.some(s => s.uploading)) { setError("Wait for all uploads to finish."); return; }

    setSaving(true);
    setError(null);

    const artworks: ArtworkStubInput[] = stubs.map((s, i) => ({
      existingId: s.existingId,
      uploadedUrl: s.uploadedUrl,
      caption: s.caption,
      medium: s.medium,
      year: s.year ? parseInt(s.year) : null,
      forSale: s.forSale,
      price_cents: s.forSale && s.price && !s.is_poa ? Math.round(parseFloat(s.price) * 100) : null,
      price_currency: s.currency,
      is_poa: s.is_poa,
      position: i,
    }));

    const result = await createSeries({ title: title.trim(), description: description.trim() || null, hero_image_url: heroUrl, artworks });

    if (result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      router.push(`/studio/series/${result.seriesId}`);
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const handleArtworkDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleArtworkFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Breadcrumb */}
      <div className="space-y-0.5">
        <Link href="/studio?section=works&wt=series" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Works / Series
        </Link>
        <h1 className="text-xl font-semibold">Create Series</h1>
      </div>

      {/* Hero image */}
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
      </div>

      {/* Title + description */}
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-widest text-stone-400">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Coastal Series"
            className="w-full text-sm border-b border-border focus:border-foreground focus:outline-none pb-1 bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-widest text-stone-400">Description <span className="normal-case font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A few sentences about this series…"
            rows={3}
            className="w-full text-sm border border-border focus:border-foreground focus:outline-none p-2 bg-transparent resize-none"
          />
        </div>
      </div>

      {/* Artworks */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Artworks</p>

        {stubs.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stubs.map(s => s.stubId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {stubs.map(stub => (
                  <SortableStubCard
                    key={stub.stubId}
                    stub={stub}
                    onChange={(updates) => updateStub(stub.stubId, updates)}
                    onRemove={() => removeStub(stub.stubId)}
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

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="bg-black text-white text-sm px-6 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create Series →"}
      </button>

      {/* Artwork picker modal */}
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
                  const added = stubs.some(s => s.existingId === work.id);
                  return (
                    <button
                      key={work.id}
                      onClick={() => { addExistingArtwork(work); setPickerOpen(false); }}
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
