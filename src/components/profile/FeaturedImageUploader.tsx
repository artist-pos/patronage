"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const MAX_PX = 3840;

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

export function FeaturedImageUploader({ profileId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [focusY, setFocusY] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("profiles")
      .select("featured_image_url, banner_focus_y")
      .eq("id", profileId)
      .single()
      .then(({ data }) => {
        setImageUrl(data?.featured_image_url ?? null);
        setFocusY(data?.banner_focus_y ?? 50);
      });
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await resizeToJpeg(file);
      const path = `${profileId}/__featured.jpg`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) { setError(upErr.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);
      const url = urlData.publicUrl;

      await supabase.from("profiles").update({ featured_image_url: url }).eq("id", profileId);
      setImageUrl(url);
    } catch {
      setError("Failed to process image.");
    }
    setUploading(false);
  }

  function handleFocusChange(value: number) {
    setFocusY(value);
    // Debounce the DB write — only save 600ms after the user stops dragging
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase.from("profiles").update({ banner_focus_y: value }).eq("id", profileId);
    }, 600);
  }

  function handleRemove() {
    startTransition(async () => {
      const path = `${profileId}/__featured.jpg`;
      await supabase.storage.from("portfolio").remove([path]);
      await supabase.from("profiles").update({ featured_image_url: null }).eq("id", profileId);
      setImageUrl(null);
    });
  }

  return (
    <div className="space-y-4">
      {imageUrl && (
        <div className="space-y-3">
          {/* Letterbox preview — same aspect ratio as the public banner */}
          <div
            className="group relative w-full overflow-hidden border border-black bg-neutral-100"
            style={{ aspectRatio: "42 / 9" }}
          >
            <Image
              src={imageUrl}
              alt="Featured artwork preview"
              fill
              unoptimized
              className="object-cover"
              style={{ objectPosition: `center ${focusY}%` }}
              sizes="100vw"
            />
            {/* Focal point indicator line */}
            <div
              className="absolute left-0 right-0 h-px bg-white/70 pointer-events-none"
              style={{ top: `${focusY}%` }}
            />
            {/* Remove floater */}
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            >
              Remove
            </button>
          </div>

          {/* Focal point slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Top</span>
              <span className="font-mono">{focusY}%</span>
              <span>Bottom</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={focusY}
              onChange={(e) => handleFocusChange(Number(e.target.value))}
              className="w-full accent-black cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Drag to choose which part of the image is visible in the banner.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-4 file:border file:border-black file:bg-transparent file:text-sm file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Landscape images work best. Resized to max 3840px (4K).
        </p>
        {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
