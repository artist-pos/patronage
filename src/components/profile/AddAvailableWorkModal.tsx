"use client";

import { useEffect, useRef, useState } from "react";
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
import type { Artwork } from "@/types/database";

const MAX_PX = 1600;
const NAME_MAX = 140;
const DESC_MAX = 280;

const MEDIUM_CATEGORIES = [
  "Painting", "Drawing", "Sculpture", "Photography", "Printmaking",
  "Mixed Media", "Textile", "Ceramic", "Digital", "Installation", "Video", "Other",
] as const;

const SURFACE_OPTIONS = [
  "Canvas", "Paper", "Board", "Wood", "Metal", "Glass",
  "Fabric", "Found Object", "Wall", "Other", "N/A",
] as const;

function buildSuggestion(cats: string[], surface: string): string {
  if (cats.length === 0) return "";
  const catStr = cats.map((c) => c.toLowerCase()).join(", ");
  if (surface && surface !== "N/A") return `${catStr} on ${surface.toLowerCase()}`;
  return catStr;
}

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
  onSuccess: (work: Artwork) => void;
}

export function AddAvailableWorkModal({ profileId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [mediumCategory, setMediumCategory] = useState<string[]>([]);
  const [surfaceOrSubstrate, setSurfaceOrSubstrate] = useState("");
  const [medium, setMedium] = useState("");
  const [price, setPrice] = useState("");
  const [priceCurrency, setPriceCurrency] = useState<"NZD" | "AUD">("NZD");
  const [poa, setPoa] = useState(false);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-suggest free-text medium from structured selections when field is empty
  useEffect(() => {
    if (medium) return;
    const suggestion = buildSuggestion(mediumCategory, surfaceOrSubstrate);
    if (suggestion) setMedium(suggestion);
  }, [mediumCategory, surfaceOrSubstrate]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCategory(cat: string) {
    setMediumCategory((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function reset() {
    setFile(null);
    setName("");
    setMediumCategory([]);
    setSurfaceOrSubstrate("");
    setMedium("");
    setPrice("");
    setPriceCurrency("NZD");
    setPoa(false);
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
    if (!poa && !price.trim()) { setError("Enter a price or select 'Price on application'."); return; }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      const blob = await resizeToJpeg(file);
      const safeName = file.name.replace(/[^a-z0-9.]/gi, "_");
      const path = `${profileId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);

      const priceMajor = parseFloat(price.trim());
      const priceCentsVal = !poa && Number.isFinite(priceMajor) ? Math.round(priceMajor * 100) : null;

      const { data: row, error: dbErr } = await supabase
        .from("artworks")
        .insert({
          profile_id: profileId,
          creator_id: profileId,
          current_owner_id: profileId,
          url: publicUrl,
          caption: name.trim(),
          price_cents: priceCentsVal,
          is_poa: poa,
          price_currency: priceCurrency,
          medium: medium.trim() || null,
          medium_category: mediumCategory.length ? mediumCategory : null,
          surface_or_substrate: surfaceOrSubstrate.trim() || null,
          description: description.trim() || null,
          is_available: true,
          position: 9999,
        })
        .select()
        .single();

      if (dbErr || !row) throw new Error(dbErr?.message ?? "Failed to save listing.");

      toast.success(`Work "${name.trim()}" is now listed as available.`);
      onSuccess(row as Artwork);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = !!file && name.trim().length > 0 && (poa || price.trim().length > 0) && !uploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity font-medium">
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
              placeholder="Use a concise, recognisable title."
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* ── Medium Category ── */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Medium Category
              <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional, select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {MEDIUM_CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mediumCategory.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                    className="accent-black"
                  />
                  <span className="text-xs">{cat}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Surface + Medium free-text ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Surface / Substrate
                <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional)</span>
              </label>
              <select
                value={surfaceOrSubstrate}
                onChange={(e) => setSurfaceOrSubstrate(e.target.value)}
                className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
              >
                <option value="">— none —</option>
                {SURFACE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Medium / Material
                <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                placeholder="e.g. Oil on canvas"
                className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* ── Price ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Price <span className="text-destructive">*</span>
            </label>
            {!poa && (
              <div className="flex gap-2">
                <select
                  value={priceCurrency}
                  onChange={(e) => setPriceCurrency(e.target.value as "NZD" | "AUD")}
                  className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground w-24"
                >
                  <option value="NZD">NZD</option>
                  <option value="AUD">AUD</option>
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1200"
                  className="flex-1 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={poa}
                onChange={(e) => {
                  setPoa(e.target.checked);
                  if (e.target.checked) setPrice("");
                }}
                className="accent-black"
              />
              <span className="text-sm text-muted-foreground">Price on application</span>
            </label>
          </div>

          {/* ── Description / Inquiry Context ── */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium">
                Description / Enquiry Context
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
              placeholder="Dimensions, year, condition… This will be included in patron enquiry messages automatically."
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
