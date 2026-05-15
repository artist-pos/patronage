"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createWorkWithEdition } from "@/app/studio/works/edition-actions";
import type { EditionListingMode } from "@/types/database";

const MAX_PX = 1600;

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

async function resizeToWebp(file: File): Promise<Blob> {
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
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/webp",
        0.88
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface Props {
  profileId: string;
  defaultSale: boolean;
}

export function NewWorkClient({ profileId, defaultSale }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Identity
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));

  // Medium
  const [mediumCategory, setMediumCategory] = useState<string[]>([]);
  const [surface, setSurface] = useState("");
  const [medium, setMedium] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");

  // Original edition
  const [listed, setListed] = useState(defaultSale);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"NZD" | "AUD">("NZD");
  const [poa, setPoa] = useState(false);
  const [listingMode, setListingMode] = useState<EditionListingMode>("enquire");

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (medium) return;
    const suggestion = buildSuggestion(mediumCategory, surface);
    if (suggestion) setMedium(suggestion);
  }, [mediumCategory, surface]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCategory(cat: string) {
    setMediumCategory((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please choose an image."); return; }
    if (listed && !poa && !price.trim()) {
      setError("Enter a price or select price on application.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const blob = await resizeToWebp(file);
      const path = `${profileId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("portfolio")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);

      const priceMajor = parseFloat(price);
      const result = await createWorkWithEdition({
        url: publicUrl,
        title: title.trim() || null,
        year: year.trim() ? parseInt(year, 10) : null,
        medium: medium.trim() || null,
        mediumCategory: mediumCategory.length ? mediumCategory : null,
        surfaceOrSubstrate: surface || null,
        dimensions: dimensions.trim() || null,
        description: description.trim() || null,
        edition: {
          price_cents: poa || !Number.isFinite(priceMajor) ? null : Math.round(priceMajor * 100),
          currency,
          poa,
          listing_mode: listingMode,
          listed,
        },
      });

      if (result.error) throw new Error(result.error);
      router.push(`/studio/works/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {/* ── Image ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Image</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm border border-black px-3 py-1.5 hover:bg-muted/40 transition-colors whitespace-nowrap">
            {file ? "Change file" : "Browse…"}
          </span>
          {file ? (
            <span className="text-xs text-muted-foreground truncate">{file.name}</span>
          ) : (
            <span className="text-xs text-muted-foreground">No file chosen</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
          />
        </label>
        {preview && (
          <img src={preview} alt="" className="max-h-64 max-w-full object-contain bg-muted" />
        )}
      </section>

      {/* ── Identity ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Identity</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={1500}
              max={new Date().getFullYear() + 1}
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Dimensions</label>
            <input
              type="text"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="e.g. 600 × 400 mm"
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </section>

      {/* ── Medium ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Medium</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Category
            <span className="ml-1 text-[11px] text-muted-foreground font-normal">(select all that apply)</span>
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Surface / Substrate</label>
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
            >
              <option value="">— none —</option>
              {SURFACE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Medium / Material</label>
            <input
              type="text"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="e.g. Oil on canvas"
              className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Description
            <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the work — context, materials, process…"
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>
      </section>

      {/* ── Editions (original) ── */}
      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Editions</h2>
        </div>

        <div className="border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 uppercase tracking-wide">
              Original
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={listed}
                onChange={(e) => setListed(e.target.checked)}
                className="accent-black"
              />
              <span className="text-sm">Listed for sale</span>
            </label>
          </div>

          {listed && (
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={poa}
                  onChange={(e) => { setPoa(e.target.checked); if (e.target.checked) setPrice(""); }}
                  className="accent-black"
                />
                <span className="text-sm text-muted-foreground">Price on application</span>
              </label>
              {!poa && (
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "NZD" | "AUD")}
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
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Listing mode</label>
                <select
                  value={listingMode}
                  onChange={(e) => setListingMode(e.target.value as EditionListingMode)}
                  className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
                >
                  <option value="enquire">Enquire first</option>
                  <option value="direct">Direct sale</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Additional editions (prints, open editions, products) can be added after saving.
        </p>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!file || uploading}
          className="px-6 py-2.5 bg-black text-white text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {uploading ? "Saving…" : "Save work"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
