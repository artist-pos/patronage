"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { WorkImage } from "@/types/database";

interface Props {
  workId: string;
  source: "portfolio" | "artwork";
  profileId: string;
  existingImages: WorkImage[];
}

export function WorkImagesManager({ workId, source, profileId, existingImages }: Props) {
  const [images, setImages] = useState<WorkImage[]>(existingImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profileId}/work-images/${workId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);
      const url = urlData.publicUrl;

      const sourceKey = source === "portfolio" ? "portfolio_image_id" : "artwork_id";
      const { data: newRow, error: insertError } = await supabase
        .from("work_images")
        .insert({
          [sourceKey]: workId,
          url,
          position: images.length,
          is_primary: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setImages(prev => [...prev, newRow as WorkImage]);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSetPrimary(id: string) {
    const supabase = createClient();
    // Unset all, then set this one
    await supabase
      .from("work_images")
      .update({ is_primary: false })
      .or(`portfolio_image_id.eq.${workId},artwork_id.eq.${workId}`);
    await supabase
      .from("work_images")
      .update({ is_primary: true })
      .eq("id", id);
    setImages(prev => prev.map(img => ({ ...img, is_primary: img.id === id })));
    router.refresh();
  }

  async function handleDelete(img: WorkImage) {
    const supabase = createClient();
    // Extract storage path from URL
    const marker = "/object/public/portfolio/";
    const idx = img.url.indexOf(marker);
    if (idx !== -1) {
      const storagePath = img.url.slice(idx + marker.length);
      await supabase.storage.from("portfolio").remove([storagePath]);
    }
    await supabase.from("work_images").delete().eq("id", img.id);
    setImages(prev => prev.filter(i => i.id !== img.id));
    router.refresh();
  }

  async function handleMove(id: string, dir: -1 | 1) {
    const idx = images.findIndex(i => i.id === id);
    if (idx + dir < 0 || idx + dir >= images.length) return;
    const next = [...images];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    const updated = next.map((img, i) => ({ ...img, position: i }));
    setImages(updated);

    const supabase = createClient();
    await Promise.all(
      updated.map(img =>
        supabase.from("work_images").update({ position: img.position }).eq("id", img.id)
      )
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={img.id} className="relative group flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption ?? ""}
                className={`h-16 w-auto block border ${img.is_primary ? "border-black" : "border-border"}`}
              />
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  onClick={() => handleMove(img.id, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move left"
                >
                  ←
                </button>
                <button
                  onClick={() => handleMove(img.id, 1)}
                  disabled={i === images.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move right"
                >
                  →
                </button>
                <button
                  onClick={() => handleSetPrimary(img.id)}
                  className={`${img.is_primary ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {img.is_primary ? "Primary" : "Set primary"}
                </button>
                <button
                  onClick={() => handleDelete(img)}
                  className="text-destructive hover:opacity-70 ml-1"
                  aria-label="Delete image"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          id="work-image-upload"
        />
        <label
          htmlFor="work-image-upload"
          className={`inline-flex items-center gap-2 text-xs border border-border px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {uploading ? "Uploading…" : "+ Add photo"}
        </label>
      </div>
    </div>
  );
}
