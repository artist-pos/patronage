"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { GripVertical } from "lucide-react";
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
  horizontalListSortingStrategy,
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

// ── Sortable thumbnail item ──────────────────────────────────────────────────
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
    opacity: isDragging ? 0.25 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-none flex flex-col gap-1.5"
    >
      {/* Thumbnail — fixed height, width follows natural aspect ratio */}
      <div
        className="relative group border border-border overflow-hidden bg-muted"
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

        {/* Drag handle — always visible, top-left */}
        <div
          {...listeners}
          {...attributes}
          className="absolute top-1 left-1 bg-background/80 p-0.5 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </div>

        {/* Remove overlay — on hover */}
        <button
          onClick={() => onRemove(img)}
          disabled={isPending}
          className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
        >
          Remove
        </button>
      </div>

      {/* Caption — width matches thumbnail */}
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

  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
            .insert({ profile_id: profileId, url, position: images.length + uploaded.length })
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(images, oldIndex, newIndex);
    setImages(reordered);

    // Persist new positions to Supabase
    await Promise.all(
      reordered.map((img, i) =>
        supabase.from("portfolio_images").update({ position: i }).eq("id", img.id)
      )
    );
  }

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

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((i) => i.id)}
            strategy={horizontalListSortingStrategy}
          >
            {/* Flex row — variable width thumbnails at fixed height */}
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
        </DndContext>
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
