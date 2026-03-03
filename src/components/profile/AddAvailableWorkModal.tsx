"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PortfolioImage } from "@/types/database";

const MAX_PX = 1600;
const NAME_MAX = 140;
const DESC_MAX = 280;

async function resizeToJpeg(file: File): Promise<Blob> {
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
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  profileId: string;
  onSuccess: (work: PortfolioImage) => void;
}

export function AddAvailableWorkModal({ profileId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setName("");
    setPrice("");
    setDescription("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please choose an image."); return; }
    if (!name.trim()) { setError("Work name is required."); return; }
    if (!price.trim()) { setError("Price is required."); return; }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Resize + upload to storage
      const blob = await resizeToJpeg(file);
      const safeName = file.name.replace(/[^a-z0-9.]/gi, "_");
      const path = `${profileId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);

      // Insert portfolio_images row
      const { data: row, error: dbErr } = await supabase
        .from("portfolio_images")
        .insert({
          profile_id: profileId,
          url: publicUrl,
          caption: name.trim(),
          price: price.trim(),
          description: description.trim() || null,
          is_available: true,
          position: 9999,
        })
        .select()
        .single();

      if (dbErr || !row) throw new Error(dbErr?.message ?? "Failed to save listing.");

      toast.success(`Work "${name.trim()}" is now listed as available.`);
      onSuccess(row as PortfolioImage);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = !!file && name.trim().length > 0 && price.trim().length > 0 && !uploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors font-medium">
          + Add Available Work
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Available Work</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">

          {/* ── Image upload ── */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Upload an image of your available work.
            </p>
            <label className="block">
              <div className="flex items-center gap-3">
                <span className="text-sm border border-black px-3 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors whitespace-nowrap">
                  {file ? "Change file" : "Browse…"}
                </span>
                {file ? (
                  <span className="text-xs text-muted-foreground truncate">
                    {file.name} — {formatSize(file.size)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No file chosen</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </label>
          </div>

          {/* ── Name of Work ── */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">
                Name of Work <span className="text-destructive">*</span>
              </label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {name.length}/{NAME_MAX}
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              placeholder="Use a concise, recognizable title."
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">Use a concise, recognizable title.</p>
          </div>

          {/* ── Price ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Price <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g., $1,200 or POA"
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* ── Description / Inquiry Context ── */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">
                Description / Inquiry Context
                <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional)</span>
              </label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {description.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              rows={4}
              placeholder="Medium, dimensions, year, condition… This will be included in patron enquiry messages."
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* ── Error ── */}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* ── Footer ── */}
          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm px-4 py-2 border border-border hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="text-sm px-4 py-2 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {uploading ? "Publishing…" : "Publish Listing"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
