"use client";

import { useState, useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { savePartnerDocument, deletePartnerDocument } from "@/app/partner/opportunities/[id]/new/actions";
import type { PartnerDocument } from "@/types/database";

interface Props {
  opportunityId: string;
  documents: PartnerDocument[];
  onUploaded: (doc: PartnerDocument) => void;
  onDeleted: (id: string) => void;
}

export function PartnerDocumentsUploader({ opportunityId, documents, onUploaded, onDeleted }: Props) {
  const [uploading, setUploading] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFile(file: File) {
    const label = labelInput.trim() || file.name.replace(/\.[^.]+$/, "");
    setUploading(true);
    const path = `briefs/${opportunityId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setUploading(false);
      return;
    }
    const sizeKb = Math.round(file.size / 1024);
    const result = await savePartnerDocument(opportunityId, label, path, sizeKb);
    setUploading(false);
    if (result.doc) {
      onUploaded(result.doc);
      setLabelInput("");
    }
  }

  async function handleDelete(doc: PartnerDocument) {
    await supabase.storage.from("opportunity-images").remove([doc.storage_path]);
    await deletePartnerDocument(doc.id);
    onDeleted(doc.id);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Assessor documents <span className="text-stone-400 font-normal">optional</span></h3>
        <p className="text-xs text-stone-500">
          Upload briefs, rubric guides, or reference material for your review committee. Not visible to applicants.
        </p>
      </div>

      {documents.length > 0 && (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between border border-black/10 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span className="truncate">{doc.label}</span>
                <span className="text-xs text-stone-400 shrink-0">{doc.file_size_kb} KB</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc)}
                className="text-stone-400 hover:text-foreground transition-colors ml-3 shrink-0"
                aria-label="Remove document"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Document label (optional — defaults to filename)"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 border border-dashed border-black/40 px-4 py-2.5 text-sm text-stone-500 hover:border-black hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Paperclip className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : "Upload document (PDF, Word, image)"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    </div>
  );
}
