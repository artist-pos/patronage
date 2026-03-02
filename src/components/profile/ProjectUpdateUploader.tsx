"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { ProjectUpdate } from "@/types/database";

const MAX_PX = 1600;
const MAX_CAPTION = 120;

async function resizeImage(file: File): Promise<Blob> {
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
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.9
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface Props {
  profileId: string;
}

export function ProjectUpdateUploader({ profileId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("project_updates")
      .select("*")
      .eq("artist_id", profileId)
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setUpdates((data ?? []) as ProjectUpdate[]));
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    const resized = await resizeImage(file);
    setBlob(resized);
    setPreview(URL.createObjectURL(resized));
  }

  async function handlePost() {
    if (!blob) return;
    setError(null);
    setUploading(true);
    try {
      const path = `${profileId}/updates/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) { setError(upErr.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);
      const { data: inserted } = await supabase
        .from("project_updates")
        .insert({ artist_id: profileId, image_url: urlData.publicUrl, caption: caption.trim() || null })
        .select()
        .single();

      if (inserted) setUpdates((prev) => [inserted as ProjectUpdate, ...prev]);
      setPreview(null);
      setBlob(null);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Failed to post update.");
    }
    setUploading(false);
  }

  async function handleDelete(id: string, imageUrl: string) {
    const path = imageUrl.split("/portfolio/")[1];
    await supabase.storage.from("portfolio").remove([path]);
    await supabase.from("project_updates").delete().eq("id", id);
    setUpdates((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="space-y-3">
        {preview ? (
          <div className="relative w-full max-w-sm">
            <Image
              src={preview}
              alt="Preview"
              width={400}
              height={400}
              className="w-full h-auto max-h-[300px] object-contain border border-black"
            />
            <button
              onClick={() => { setPreview(null); setBlob(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="absolute top-2 right-2 text-xs bg-background border border-black px-2 py-1 hover:bg-muted transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-4 file:border file:border-black file:bg-transparent file:text-sm file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
          />
        )}

        {preview && (
          <div className="space-y-2 max-w-sm">
            <div className="relative">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder="Add a caption… (optional, max 120 chars)"
                rows={2}
                className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
              />
              <span className="absolute bottom-2 right-2 text-xs text-muted-foreground font-mono">
                {caption.length}/{MAX_CAPTION}
              </span>
            </div>
            <button
              onClick={handlePost}
              disabled={uploading}
              className="border border-black px-4 py-2 text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
            >
              {uploading ? "Posting…" : "Post update"}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Existing updates grid */}
      {updates.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {updates.map((u) => (
            <div key={u.id} className="group relative aspect-square border border-border overflow-hidden bg-muted">
              <Image
                src={u.image_url}
                alt={u.caption ?? "Studio update"}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 33vw, 200px"
              />
              {u.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-background/80 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs leading-snug line-clamp-2">{u.caption}</p>
                </div>
              )}
              <button
                onClick={() => handleDelete(u.id, u.image_url)}
                className="absolute top-1 right-1 text-xs bg-background border border-black px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white hover:border-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
