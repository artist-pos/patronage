"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { detectOrientation } from "@/lib/image";
import { createPortfolioWork } from "@/app/dashboard/works/actions";

const MAX_PX = 1600;

async function resizeToJpeg(file: File): Promise<{
  blob: Blob;
  orientation: "landscape" | "portrait" | "square";
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        blob =>
          blob
            ? resolve({ blob, orientation: detectOrientation(canvas.width, canvas.height), width: canvas.width, height: canvas.height })
            : reject(new Error("Resize failed")),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface Props {
  profileId: string;
  onCancel: () => void;
  onSaved: () => void;
}

const inputCls =
  "w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black";

export function NewArtworkEditor({ profileId, onCancel, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [medium, setMedium] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (!file) { setError("Please select an image first."); return; }
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { blob, orientation, width, height } = await resizeToJpeg(file);
      const path = `${profileId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;

      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);

      // Get current max position
      const { data: existing } = await supabase
        .from("portfolio_images")
        .select("position")
        .eq("profile_id", profileId)
        .eq("is_available", false)
        .order("position", { ascending: false })
        .limit(1);
      const position = (existing?.[0]?.position ?? -1) + 1;

      const result = await createPortfolioWork({
        url: urlData.publicUrl,
        orientation,
        naturalWidth: width,
        naturalHeight: height,
        title: title || null,
        year: year ? parseInt(year) : null,
        medium: medium || null,
        dimensions: dimensions || null,
        description: description || null,
        position,
      });

      if (result.error) throw new Error(result.error);

      router.refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSaving(false);
    }
  }

  return (
    <div className="border border-black bg-background">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-black flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
          Add Work
        </p>
        <button
          onClick={onCancel}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Two-column body */}
      <div className="flex min-h-0">
        {/* Left — Image upload */}
        <div className="w-[38%] shrink-0 border-r border-black p-5 space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Image
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            id="new-work-upload"
          />

          {preview ? (
            <div className="space-y-3">
              <div
                className="border border-border bg-muted overflow-hidden flex items-center justify-center"
                style={{ aspectRatio: "4/3" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="w-full h-full object-contain" />
              </div>
              <label
                htmlFor="new-work-upload"
                className="inline-block text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2"
              >
                Change image
              </label>
            </div>
          ) : (
            <label
              htmlFor="new-work-upload"
              className="flex flex-col items-center justify-center border border-dashed border-border cursor-pointer hover:border-black transition-colors text-muted-foreground hover:text-foreground"
              style={{ aspectRatio: "4/3" }}
            >
              <span className="text-sm">+ Upload image</span>
              <span className="text-[10px] mt-1">JPEG, PNG, WebP</span>
            </label>
          )}

          <p className="text-[10px] text-muted-foreground">
            Gallery images can be added after saving via the Edit button.
          </p>
        </div>

        {/* Right — Metadata */}
        <div className="flex-1 p-5 space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
            Details
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-muted-foreground">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Year</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder={String(new Date().getFullYear())} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Medium</label>
              <input type="text" value={medium} onChange={e => setMedium(e.target.value)} placeholder="Oil on canvas" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Dimensions</label>
              <input type="text" value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="60 × 90 cm" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notes about this work — materials, context, edition details…"
              rows={6}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 border-t border-black bg-background px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !file}
            className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : "Add Work"}
          </button>
          <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2">
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
