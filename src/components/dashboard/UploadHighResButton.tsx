"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitHighResAsset } from "@/app/dashboard/actions";

interface Props {
  applicationId: string;
}

export function UploadHighResButton({ applicationId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleFile(file: File) {
    // Enforce 10 MB limit
    if (file.size > 10 * 1024 * 1024) {
      setToast("File too large — maximum 10 MB.");
      setTimeout(() => setToast(null), 4000);
      return;
    }

    // Magic byte validation
    const headerBytes = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(headerBytes);
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    const isWebP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    const isTiff = (bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4D && bytes[1] === 0x4D);
    if (!isJpeg && !isPng && !isWebP && !isPdf && !isTiff) {
      setToast("Invalid file type. Accepted: JPEG, PNG, WebP, TIFF, PDF.");
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${applicationId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("production-assets")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setToast("Upload failed: " + uploadError.message);
        setTimeout(() => setToast(null), 4000);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("production-assets").getPublicUrl(path);
      const result = await submitHighResAsset(applicationId, publicUrl);
      if (result.error) {
        setToast("Error: " + result.error);
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast("Uploaded successfully!");
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full sm:w-auto bg-black text-white text-xs px-4 py-2 hover:bg-black/80 transition-colors disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload High-Res File"}
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/tiff,image/webp,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {toast && (
        <p className={`text-xs ${toast.startsWith("Uploaded") ? "text-green-600" : "text-destructive"}`}>
          {toast}
        </p>
      )}
    </div>
  );
}
