"use client";

import { useState, useEffect, useRef } from "react";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateWorkMetadata } from "@/app/dashboard/works/actions";
import type { WorkImage } from "@/types/database";

export interface EditableWork {
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  description: string | null;
  content_type: string;
}

interface Props {
  work: EditableWork;
  profileId: string;
  onCancel: () => void;
  onSaved: (updated: Partial<EditableWork>) => void;
}

// ── Sortable gallery thumbnail ───────────────────────────────────────────────

function GalleryItem({
  img,
  onSetPrimary,
  onDelete,
}: {
  img: WorkImage;
  onSetPrimary: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: img.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={`relative group w-[72px] h-[72px] shrink-0 overflow-hidden bg-muted border ${
        img.is_primary ? "border-black" : "border-border"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt="" className="w-full h-full object-cover" />

      {/* Drag handle — hover only */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-black/60 p-[3px]"
      >
        <GripVertical size={9} className="text-white" />
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white w-4 h-4 flex items-center justify-center text-[11px] leading-none"
        aria-label="Remove image"
      >
        ×
      </button>

      {/* Primary label */}
      <button
        onClick={onSetPrimary}
        className={`absolute bottom-0 left-0 right-0 text-[9px] py-[3px] text-center transition-colors ${
          img.is_primary
            ? "bg-black text-white"
            : "opacity-0 group-hover:opacity-100 bg-black/60 text-white"
        }`}
      >
        {img.is_primary ? "Primary" : "Set primary"}
      </button>
    </div>
  );
}

// ── Main editor ──────────────────────────────────────────────────────────────

export function ArtworkEditor({ work, profileId, onCancel, onSaved }: Props) {
  // Metadata form
  const [title, setTitle] = useState(work.title ?? "");
  const [year, setYear] = useState(work.year ? String(work.year) : "");
  const [medium, setMedium] = useState(work.medium ?? "");
  const [dimensions, setDimensions] = useState(work.dimensions ?? "");
  const [description, setDescription] = useState(work.description ?? "");

  // Gallery
  const [images, setImages] = useState<WorkImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [uploading, setUploading] = useState(false);

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch gallery images on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("work_images")
      .select("*")
      .eq("portfolio_image_id", work.id)
      .order("position", { ascending: true })
      .then(({ data }) => {
        setImages(data ?? []);
        setLoadingImages(false);
      });
  }, [work.id]);

  // ── Gallery actions ──────────────────────────────────────────────────────

  async function persistOrder(reordered: WorkImage[]) {
    const supabase = createClient();
    await Promise.all(
      reordered.map(img =>
        supabase
          .from("work_images")
          .update({ position: img.position, is_primary: img.is_primary })
          .eq("id", img.id)
      )
    );
  }

  function reorderWithPrimary(arr: WorkImage[]): WorkImage[] {
    return arr.map((img, i) => ({ ...img, position: i, is_primary: i === 0 }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex(i => i.id === active.id);
    const newIndex = images.findIndex(i => i.id === over.id);
    const reordered = reorderWithPrimary(arrayMove(images, oldIndex, newIndex));
    setImages(reordered);
    persistOrder(reordered);
  }

  function handleSetPrimary(id: string) {
    const reordered = reorderWithPrimary([
      images.find(i => i.id === id)!,
      ...images.filter(i => i.id !== id),
    ]);
    setImages(reordered);
    persistOrder(reordered);
  }

  async function handleDeleteImage(img: WorkImage) {
    const supabase = createClient();
    const marker = "/object/public/portfolio/";
    const idx = img.url.indexOf(marker);
    if (idx !== -1) {
      await supabase.storage.from("portfolio").remove([img.url.slice(idx + marker.length)]);
    }
    await supabase.from("work_images").delete().eq("id", img.id);
    const remaining = reorderWithPrimary(images.filter(i => i.id !== img.id));
    setImages(remaining);
    if (remaining.length > 0) persistOrder(remaining);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profileId}/work-images/${work.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);

      const { data: newRow, error: insertError } = await supabase
        .from("work_images")
        .insert({
          portfolio_image_id: work.id,
          url: urlData.publicUrl,
          position: images.length,
          is_primary: images.length === 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setImages(prev => [...prev, newRow as WorkImage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Save metadata ────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateWorkMetadata(work.id, "portfolio_images", {
      title,
      year: year ? parseInt(year) : null,
      medium,
      dimensions,
      description,
    });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    onSaved({
      title: title || null,
      year: year ? parseInt(year) : null,
      medium: medium || null,
      dimensions: dimensions || null,
      description: description || null,
    });
    setSaving(false);
  }

  const primaryImage = images.find(i => i.is_primary);
  const previewUrl = primaryImage?.url ?? work.url;
  const isImage = !work.content_type || work.content_type === "image";

  const inputCls =
    "w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black";

  return (
    <div className="border border-black bg-background">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-black flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
          Edit Work
        </p>
        <button
          onClick={onCancel}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Two-column body */}
      <div className="flex min-h-0">
        {/* Left — Media Manager */}
        <div className="w-[38%] shrink-0 border-r border-black p-5 space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Media
          </p>

          {/* Primary preview */}
          <div className="border border-border bg-muted overflow-hidden flex items-center justify-center"
               style={{ aspectRatio: "4/3" }}>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={work.caption ?? ""}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {work.content_type}
              </span>
            )}
          </div>

          {/* Gallery grid with DnD */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Gallery
            </p>

            {loadingImages ? (
              <p className="text-[11px] text-muted-foreground">Loading…</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={images.map(i => i.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="flex flex-wrap gap-2">
                    {images.map(img => (
                      <GalleryItem
                        key={img.id}
                        img={img}
                        onSetPrimary={() => handleSetPrimary(img.id)}
                        onDelete={() => handleDeleteImage(img)}
                      />
                    ))}

                    {/* Upload slot */}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUpload}
                      className="hidden"
                      id={`gallery-upload-${work.id}`}
                    />
                    <label
                      htmlFor={`gallery-upload-${work.id}`}
                      className={`w-[72px] h-[72px] border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground cursor-pointer hover:border-black hover:text-foreground transition-colors ${
                        uploading ? "opacity-40 pointer-events-none" : ""
                      }`}
                    >
                      {uploading ? "…" : "+ Add"}
                    </label>
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {images.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Drag to reorder · first image is shown as primary
              </p>
            )}
          </div>
        </div>

        {/* Right — Metadata form */}
        <div className="flex-1 p-5 space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Details
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Title — full width */}
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-muted-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={work.caption ?? "Untitled"}
                className={inputCls}
              />
            </div>

            {/* Year */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Year</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder={String(new Date().getFullYear())}
                className={inputCls}
              />
            </div>

            {/* Medium */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Medium</label>
              <input
                type="text"
                value={medium}
                onChange={e => setMedium(e.target.value)}
                placeholder="Oil on canvas"
                className={inputCls}
              />
            </div>

            {/* Dimensions — half width */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Dimensions</label>
              <input
                type="text"
                value={dimensions}
                onChange={e => setDimensions(e.target.value)}
                placeholder="60 × 90 cm"
                className={inputCls}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notes about this work — materials, context, edition details…"
              rows={6}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 border-t border-black bg-background px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
