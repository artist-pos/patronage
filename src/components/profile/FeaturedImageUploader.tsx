"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const MAX_PX = 2400;

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("profiles")
      .select("featured_image_url")
      .eq("id", profileId)
      .single()
      .then(({ data }) => setImageUrl(data?.featured_image_url ?? null));
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

  return (
    <div className="space-y-4">
      {imageUrl && (
        <div className="relative w-full aspect-[16/9] max-w-sm overflow-hidden border border-black">
          <Image src={imageUrl} alt="Featured artwork" fill className="object-cover" sizes="384px" />
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
          Displayed on your directory card. Landscape images work best. Resized to max 1600px.
        </p>
        {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
