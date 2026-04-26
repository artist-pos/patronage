"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumentationPhoto, deleteDocumentationPhoto } from "./actions";
import { DOC_PHOTO_TYPES, type DocPhotoType } from "@/lib/artwork-documentation";

interface ExistingPhoto {
  id: string;
  type: DocPhotoType;
  caption: string | null;
  signedUrl: string | null;
}

interface Props {
  artworkId: string;
  initialPhotos: ExistingPhoto[];
}

export function DocumentationPhotosEditor({ artworkId, initialPhotos }: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [open, setOpen] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocPhotoType | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputsRef = useRef<Record<DocPhotoType, HTMLInputElement | null>>({
    verso: null, signature: null, scale: null, detail: null, other: null,
  });

  async function handleUpload(type: DocPhotoType, file: File) {
    setUploadError(null);
    setUploadingType(type);
    const fd = new FormData();
    fd.set("artworkId", artworkId);
    fd.set("type", type);
    fd.set("file", file);
    const result = await uploadDocumentationPhoto(fd);
    setUploadingType(null);
    if (result.error) {
      setUploadError(result.error);
    } else {
      // Server action revalidates the path; re-fetch via router refresh and
      // optimistically add a placeholder so the UI updates immediately.
      router.refresh();
    }
  }

  async function handleDelete(photoId: string) {
    setDeletingId(photoId);
    const result = await deleteDocumentationPhoto(photoId);
    setDeletingId(null);
    if (!result.error) {
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      router.refresh();
    }
  }

  const counts = photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.type] = (acc[p.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="border border-stone-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-stone-900">Documentation photos</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Verso, signature, scale and detail shots — only the artist and current owner can view them.{" "}
            <span className="text-stone-700">{photos.length} uploaded</span>
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 py-5 space-y-6">
          {DOC_PHOTO_TYPES.map(t => {
            const typePhotos = photos.filter(p => p.type === t.id);
            return (
              <div key={t.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                      {t.label}
                      {counts[t.id] ? <span className="ml-2 text-stone-400">{counts[t.id]}</span> : null}
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{t.hint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => inputsRef.current[t.id]?.click()}
                    disabled={uploadingType === t.id}
                    className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors text-stone-600 disabled:opacity-50"
                  >
                    {uploadingType === t.id ? "Uploading…" : "Add photo"}
                  </button>
                  <input
                    ref={el => { inputsRef.current[t.id] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(t.id, f);
                      e.target.value = "";
                    }}
                  />
                </div>
                {typePhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {typePhotos.map(p => (
                      <div key={p.id} className="relative group">
                        <div className="aspect-square bg-stone-100 rounded border border-stone-200 overflow-hidden">
                          {p.signedUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.signedUrl} alt={p.caption ?? t.label} className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          aria-label="Delete photo"
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-stone-200 text-stone-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </div>
      )}
    </section>
  );
}
