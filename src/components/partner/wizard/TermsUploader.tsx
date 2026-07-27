"use client";

import { useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  opportunityId: string;
  termsPdfUrl: string | null;
  onChange: (url: string | null) => void;
}

export function TermsUploader({ opportunityId, termsPdfUrl, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const path = `terms/${opportunityId}/terms-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: "application/pdf", upsert: true });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    onChange(publicUrl);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Terms &amp; conditions <span className="text-stone-400 font-normal">optional</span></h3>
        <p className="text-xs text-stone-500">
          One PDF (multiple pages OK) for artists to read before applying. Shown next to the Apply button once published.
        </p>
      </div>

      {termsPdfUrl ? (
        <div className="flex items-center justify-between border border-black/10 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <a href={termsPdfUrl} target="_blank" rel="noopener noreferrer" className="truncate underline underline-offset-2">
              View current PDF →
            </a>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-stone-400 hover:text-foreground transition-colors ml-3 shrink-0"
            aria-label="Remove terms & conditions PDF"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 border border-dashed border-black/40 px-4 py-2.5 text-sm text-stone-500 hover:border-black hover:text-foreground transition-colors disabled:opacity-50"
        >
          <FileText className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
