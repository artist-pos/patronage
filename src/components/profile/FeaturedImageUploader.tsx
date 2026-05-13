"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload-image";

interface Props {
  profileId: string;
}

export function FeaturedImageUploader({ profileId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [focusY, setFocusY] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

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
  }, [profileId, supabase]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const path = `${profileId}/__featured.webp`;
      const { url } = await uploadImage(file, {
        bucket: "portfolio",
        path,
        maxWidth: 1600,
        quality: 85,
        upsert: true,
      });

      await supabase.from("profiles").update({ featured_image_url: url }).eq("id", profileId);
      setImageUrl(url);
    } catch {
      setError("Failed to process image.");
    }
    setUploading(false);
  }

  function saveFocusY(value: number) {
    void supabase.from("profiles").update({ banner_focus_y: value }).eq("id", profileId).then(() => {});
  }

  function handleRemove() {
    startTransition(async () => {
      const path = `${profileId}/__featured.webp`;
      await supabase.storage.from("portfolio").remove([path]);
      await supabase.from("profiles").update({ featured_image_url: null }).eq("id", profileId);
      setImageUrl(null);
    });
  }

  return (
    <div className="space-y-4">
      {imageUrl && (
        <div className="space-y-3">
          {/* Preview — same aspect ratio as the public banner */}
          <div
            className="group relative w-full border border-black"
            style={{
              aspectRatio: "42 / 9",
              backgroundImage: `url("${imageUrl}")`,
              backgroundSize: "100% auto",
              backgroundRepeat: "no-repeat",
              backgroundPosition: `center ${focusY}%`,
              backgroundColor: "#f5f5f4",
            }}
          >
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
              onChange={(e) => setFocusY(Number(e.target.value))}
              onPointerUp={(e) => saveFocusY(Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => saveFocusY(Number((e.target as HTMLInputElement).value))}
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
