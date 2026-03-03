"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import {
  DndContext,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { PortfolioImage } from "@/types/database";

const MAX_IMAGES = 10;
const MAX_PX = 1600;
const THUMB_H = 112; // h-28 in px

async function resizeToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ── Static preview used inside DragOverlay (floating copy while dragging) ───
function ThumbPreview({ img }: { img: PortfolioImage }) {
  return (
    <div
      className="border border-border overflow-hidden bg-muted shadow-2xl"
      style={{
        height: THUMB_H,
        width: "fit-content",
        transform: "scale(1.05)",
        transformOrigin: "top left",
      }}
    >
      <Image
        src={img.url}
        alt="Portfolio image"
        width={300}
        height={THUMB_H}
        unoptimized
        style={{ height: THUMB_H, width: "auto", display: "block" }}
      />
    </div>
  );
}

// ── Sortable thumbnail ───────────────────────────────────────────────────────
function SortableThumb({
  img,
  isPending,
  onRemove,
  onCaptionBlur,
}: {
  img: PortfolioImage;
  isPending: boolean;
  onRemove: (img: PortfolioImage) => void;
  onCaptionBlur: (id: string, caption: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: img.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Invisible placeholder — holds space exactly while DragOverlay floats above
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-none flex flex-col gap-1.5"
    >
      {/*
        Image block = drag handle.
        listeners/attributes go here — NOT on the outer wrapper — so clicking the
        caption input or the delete button never starts a drag.
      */}
      <div
        {...listeners}
        {...attributes}
        className="relative group border border-border overflow-hidden bg-muted cursor-grab active:cursor-grabbing touch-none"
        style={{ height: THUMB_H, width: "fit-content" }}
      >
        <Image
          src={img.url}
          alt="Portfolio image"
          width={300}
          height={THUMB_H}
          unoptimized
          style={{ height: THUMB_H, width: "auto", display: "block" }}
        />

        {/*
          Delete button — top-right corner.
          onPointerDown stops propagation so it never triggers the drag handle.
          This is the ONLY way to remove an image.
        */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(img)}
          disabled={isPending}
          aria-label="Remove image"
          className="absolute top-1 right-1 w-5 h-5 bg-background border border-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black hover:text-white disabled:opacity-40"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Caption — below the image, not part of the drag handle */}
      <input
        type="text"
        defaultValue={img.caption ?? ""}
        placeholder="Title / Description"
        maxLength={120}
        onBlur={(e) => onCaptionBlur(img.id, e.target.value.trim() || null)}
        className="w-full text-xs border-b border-border bg-transparent py-0.5 placeholder:text-muted-foreground focus:outline-none focus:border-foreground"
        style={{ minWidth: "80px" }}
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
interface Props {
  profileId: string;
  mode?: "portfolio" | "cv";
}

export function PortfolioUploader({ profileId, mode = "portfolio" }: Props) {
  const isPortfolio = mode === "portfolio";
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  // Track unsaved reorders — only write to Supabase when the user clicks Save
  const [orderDirty, setOrderDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const sensors = useSensors(
    // distance: 8 — requires intentional drag, prevents accidental drags on tap/click
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!isPortfolio) {
      supabase
        .from("profiles")
        .select("cv_url")
        .eq("id", profileId)
        .single()
        .then(({ data }) => setCvUrl(data?.cv_url ?? null));
      return;
    }
    supabase
      .from("portfolio_images")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_available", false)
      .order("position", { ascending: true })
      .then(({ data }) => setImages((data ?? []) as PortfolioImage[]));
  }, [profileId, isPortfolio]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    if (isPortfolio) {
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) { setError(`Maximum ${MAX_IMAGES} images reached.`); return; }
      const toUpload = Array.from(files).slice(0, remaining);
      setUploading(true);

      const uploaded: PortfolioImage[] = [];
      for (const file of toUpload) {
        try {
          const blob = await resizeToJpeg(file);
          const path = `${profileId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
          const { error: upErr } = await supabase.storage
            .from("portfolio")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (upErr) { setError(upErr.message); continue; }

          const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);
          const url = urlData.publicUrl;

          const { data: row } = await supabase
            .from("portfolio_images")
            .insert({ profile_id: profileId, creator_id: profileId, current_owner_id: profileId, url, position: images.length + uploaded.length })
            .select()
            .single();
          if (row) uploaded.push(row as PortfolioImage);
        } catch {
          setError("Failed to process one or more images.");
        }
      }
      setImages((prev) => [...prev, ...uploaded]);
      setUploading(false);
    } else {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      const path = `${profileId}/cv-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("cvs")
        .upload(path, file, { contentType: "application/pdf", upsert: true });
      if (upErr) { setError(upErr.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from("cvs").getPublicUrl(path);
      const url = urlData.publicUrl;

      await supabase.from("profiles").update({ cv_url: url }).eq("id", profileId);
      setCvUrl(url);
      setUploading(false);
    }
  }

  function handleRemoveImage(img: PortfolioImage) {
    startTransition(async () => {
      const path = img.url.split("/portfolio/")[1];
      if (path) await supabase.storage.from("portfolio").remove([path]);
      await supabase.from("portfolio_images").delete().eq("id", img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    });
  }

  async function handleCaptionBlur(id: string, caption: string | null) {
    await supabase.from("portfolio_images").update({ caption }).eq("id", id);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    setImages(arrayMove(images, oldIndex, newIndex));
    setOrderDirty(true);
  }

  async function handleSaveOrder() {
    setSaving(true);
    await Promise.all(
      images.map((img, i) =>
        supabase.from("portfolio_images").update({ position: i }).eq("id", img.id)
      )
    );
    setSaving(false);
    setOrderDirty(false);
  }

  const activeImage = activeId ? images.find((i) => i.id === activeId) : null;

  // ── CV mode ─────────────────────────────────────────────────────────────────
  if (!isPortfolio) {
    return (
      <div className="space-y-4">
        {cvUrl && (
          <p className="text-sm">
            Current CV:{" "}
            <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Download
            </a>
          </p>
        )}
        <div className="flex items-center gap-4">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="text-sm file:mr-4 file:border file:border-border file:bg-transparent file:text-sm file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
          />
          {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ── Portfolio mode ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
            {/* flex-wrap so images sit at natural width; rectSortingStrategy handles the 2D layout */}
            <div className="flex flex-wrap gap-3 items-start">
              {images.map((img) => (
                <SortableThumb
                  key={img.id}
                  img={img}
                  isPending={isPending}
                  onRemove={handleRemoveImage}
                  onCaptionBlur={handleCaptionBlur}
                />
              ))}
            </div>
          </SortableContext>

          {/*
            DragOverlay renders the floating "ghost" above everything.
            The sortable item underneath becomes opacity-0, holding its exact width as
            a placeholder — so the surrounding images don't jump around.
          */}
          <DragOverlay>
            {activeImage ? <ThumbPreview img={activeImage} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Save order button — only shown when there are unsaved reorder changes */}
      {orderDirty && (
        <Button
          onClick={handleSaveOrder}
          disabled={saving}
          size="sm"
          className="bg-black text-white hover:opacity-80"
        >
          {saving ? "Saving…" : "Save order"}
        </Button>
      )}

      {images.length < MAX_IMAGES && (
        <div className="flex items-center gap-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="text-sm file:mr-4 file:border file:border-border file:bg-transparent file:text-sm file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
          />
          {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES} images</p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {images.length >= MAX_IMAGES && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">Maximum reached.</p>
          <Button variant="outline" size="sm" onClick={() => setImages([])}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
