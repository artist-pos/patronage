"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload-image";

interface Props {
  profileId: string;
}

export function AvatarUploader({ profileId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", profileId)
      .single()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [profileId, supabase]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const path = `${profileId}/__avatar.webp`;
      const { url } = await uploadImage(file, {
        bucket: "portfolio",
        path,
        maxWidth: 400,
        quality: 85,
        upsert: true,
      });

      await supabase.from("profiles").update({ avatar_url: url }).eq("id", profileId);
      setAvatarUrl(url);
    } catch {
      setError("Failed to process image.");
    }
    setUploading(false);
  }

  function handleRemove() {
    startTransition(async () => {
      const path = `${profileId}/__avatar.webp`;
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
