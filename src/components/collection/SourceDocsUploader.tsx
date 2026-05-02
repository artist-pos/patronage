"use client";

import { useRef, useState, useTransition } from "react";
import {
  uploadSourceDocument,
  deleteSourceDocument,
} from "@/app/dashboard/collection/actions";
import type {
  ArtworkSourceDocument,
  ArtworkSourceDocumentType,
} from "@/types/database";

const DOC_TYPE_OPTIONS: { value: ArtworkSourceDocumentType; label: string }[] = [
  { value: "certificate", label: "Existing certificate" },
  { value: "invoice",     label: "Invoice" },
  { value: "receipt",     label: "Gallery receipt" },
  { value: "other",       label: "Other" },
];

interface DocWithUrl extends ArtworkSourceDocument {
  signedUrl: string | null;
}

interface Props {
  artworkId: string;
  initialDocs: DocWithUrl[];
}

/**
 * Source documents are scans of the existing paper trail (gallery invoices,
 * certificates, receipts). They live in a private bucket and are never
 * surfaced publicly — only the uploader can read them via signed URL.
 */
export function SourceDocsUploader({ artworkId, initialDocs }: Props) {
  const [docs, setDocs] = useState(initialDocs);
  const [docType, setDocType] = useState<ArtworkSourceDocumentType>("certificate");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleUpload(file: File) {
    setError(null);
    const form = new FormData();
    form.set("artworkId", artworkId);
    form.set("documentType", docType);
    form.set("description", description);
    form.set("file", file);
    startTransition(async () => {
      const result = await uploadSourceDocument(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      // The signed URL is server-rendered; reload to pick up the new row.
      // Cheaper than re-fetching client-side and good enough at this volume.
      window.location.reload();
    });
  }

  function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;
    startTransition(async () => {
      const result = await deleteSourceDocument(docId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    });
  }

  return (
    <div className="space-y-4">
      <div className="border border-dashed border-stone-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Add a document</p>
        <p className="text-xs text-muted-foreground">
          Scans of paper certificates, gallery invoices, or receipts. Stored
          privately — only you can view them.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Document type</span>
            <select
              value={docType}
              onChange={(e) =>
                setDocType(e.target.value as ArtworkSourceDocumentType)
              }
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
            >
              {DOC_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Description (optional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Original gallery certificate, 2003"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
            />
          </label>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            if (fileRef.current) fileRef.current.value = "";
          }}
          disabled={isPending}
          className="text-xs"
        />
        {isPending && <p className="text-xs text-muted-foreground">Uploading…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {docs.length > 0 && (
        <ul className="divide-y divide-stone-100 border border-stone-100 rounded-lg">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 p-3">
              <span className="text-xs uppercase tracking-wider text-stone-500 min-w-[80px]">
                {doc.document_type}
              </span>
              <span className="flex-1 text-sm truncate">
                {doc.description || doc.storage_path.split("/").pop()}
              </span>
              {doc.signedUrl ? (
                <a
                  href={doc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline text-stone-700 hover:text-stone-900"
                >
                  View
                </a>
              ) : (
                <span className="text-xs text-stone-400">No preview</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={isPending}
                className="text-xs text-stone-400 hover:text-red-600 transition-colors"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
