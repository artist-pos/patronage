"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  label?: string;
  className?: string;
}

export function CreateUpdateModal({ profileId, label = "New update +", className }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  function handleClose() {
    setOpen(false);
    setPreview(null);
    setBlob(null);
    setCaption("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    const resized = await resizeImage(file);
    setBlob(resized);
    setPreview(URL.createObjectURL(resized));
  }

  async function handlePost() {
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      const path = `${profileId}/updates/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) { setError(upErr.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("project_updates")
        .insert({ artist_id: profileId, image_url: urlData.publicUrl, caption: caption.trim() || null });
      if (dbErr) { setError(dbErr.message); setUploading(false); return; }

      handleClose();
      router.refresh();
    } catch {
      setError("Failed to post update.");
    }
    setUploading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "border border-black px-4 py-2 text-sm hover:bg-black hover:text-white transition-colors"}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="w-full max-w-md bg-background border border-black">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold">Post a Studio Update</p>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {preview ? (
                <div className="relative">
                  <Image
                    src={preview}
                    alt="Preview"
                    width={400}
                    height={400}
                    style={{ width: "100%", height: "auto" }}
                    className="border border-border"
                  />
                  <button
                    onClick={() => { setPreview(null); setBlob(null); if (inputRef.current) inputRef.current.value = ""; }}
                    className="absolute top-2 right-2 text-xs bg-background border border-black px-2 py-1 hover:bg-muted transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 border border-dashed border-black cursor-pointer hover:bg-muted/40 transition-colors gap-1">
                  <span className="text-sm text-muted-foreground">Click to select an image</span>
                  <span className="text-xs text-muted-foreground">JPEG, PNG, WebP</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              )}

              <div className="relative">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                  placeholder="Add a caption… (optional)"
                  rows={3}
                  className="w-full border border-black text-sm px-3 py-2 resize-none outline-none focus:border-foreground transition-colors"
                />
                <span className="absolute bottom-2 right-2 text-xs text-muted-foreground font-mono">
                  {caption.length}/{MAX_CAPTION}
                </span>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={handleClose}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={!blob || uploading}
                  className="border border-black px-5 py-2 text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
