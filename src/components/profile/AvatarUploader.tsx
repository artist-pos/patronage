"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const AVATAR_SIZE = 400;

async function resizeToSquare(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d")!;
      // Cover-crop: scale so the short side fills the square, then centre
      const scale = Math.max(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      ctx.drawImage(img, -(scaledW - AVATAR_SIZE) / 2, -(scaledH - AVATAR_SIZE) / 2, scaledW, scaledH);
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

export function AvatarUploader({ profileId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", profileId)
      .single()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await resizeToSquare(file);
      const path = `${profileId}/__avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) { setError(upErr.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);
      const url = urlData.publicUrl;

      await supabase.from("profiles").update({ avatar_url: url }).eq("id", profileId);
      setAvatarUrl(url);
    } catch {
      setError("Failed to process image.");
    }
    setUploading(false);
  }

  function handleRemove() {
    startTransition(async () => {
      const path = `${profileId}/__avatar.jpg`;
      await supabase.storage.from("portfolio").remove([path]);
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", profileId);
      setAvatarUrl(null);
    });
  }

  return (
    <div className="flex items-center gap-6">
      <div className="group relative w-20 h-20 shrink-0 border border-black overflow-hidden bg-muted">
        {avatarUrl ? (
          <>
            <Image src={avatarUrl} alt="Profile picture" fill className="object-cover" sizes="80px" />
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            >
              Remove
            </button>
          </>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            No photo
          </span>
        )}
      </div>
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-4 file:border file:border-black file:bg-transparent file:text-sm file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Cropped and resized to 400 × 400 px before uploading.
        </p>
        {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
