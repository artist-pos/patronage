"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload-image";
import type { ProjectUpdate } from "@/types/database";

interface Props {
  profileId: string;
}

export function ProjectUpdateUploader({ profileId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
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

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handlePost() {
    if (!imageFile) return;
    setError(null);
    setUploading(true);
    try {
      const ts = Date.now();
      const path = `${profileId}/updates/${ts}.webp`;
      const thumbPath = `${profileId}/updates/${ts}-thumb.webp`;
      const { url: imageUrl, thumbUrl } = await uploadImage(imageFile, {
        bucket: "portfolio",
        path,
        maxWidth: 1600,
        quality: 90,
        thumb: true,
        thumbPath,
        thumbWidth: 800,
      });
      const { data: inserted } = await supabase
        .from("project_updates")
        .insert({ artist_id: profileId, image_url: imageUrl, thumb_url: thumbUrl ?? null, caption: caption.trim() || null })
        .select()
        .single();

      if (inserted) setUpdates((prev) => [inserted as ProjectUpdate, ...prev]);
      setPreview(null);
      setImageFile(null);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Failed to post update.");
    }
    setUploading(false);
  }

  async function handleDelete(id: string, imageUrl: string | null) {
    if (imageUrl) {
      const path = imageUrl.split("/portfolio/")[1];
      if (path) await supabase.storage.from("portfolio").remove([path]);
    }
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
              onClick={() => { setPreview(null); setImageFile(null); if (inputRef.current) inputRef.current.value = ""; }}
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
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption… (optional)"
              rows={2}
              className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
            />
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
              {u.image_url ? (
                <Image
                  src={u.image_url}
                  alt={u.caption ?? "Studio update"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, 200px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[9px] uppercase text-muted-foreground">{u.content_type ?? "update"}</span>
                </div>
              )}
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
