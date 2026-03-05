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
