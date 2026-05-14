"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateArtworkDetails } from "./actions";

const MEDIUM_CATEGORIES = [
  "Painting", "Drawing", "Sculpture", "Photography", "Printmaking",
  "Mixed Media", "Textile", "Ceramic", "Digital", "Installation", "Video", "Other",
] as const;

const SURFACE_OPTIONS = [
  "", "Canvas", "Paper", "Board", "Wood", "Metal", "Glass",
  "Fabric", "Found Object", "Wall", "Other", "N/A",
] as const;

function buildSuggestion(cats: string[], surface: string): string {
  if (cats.length === 0) return "";
  const catStr = cats.map((c) => c.toLowerCase()).join(", ");
  if (surface && surface !== "N/A") return `${catStr} on ${surface.toLowerCase()}`;
  return catStr;
}

const EDITION_TYPES = [
  { value: "unique",  label: "Unique" },
  { value: "limited", label: "Limited edition" },
  { value: "open",    label: "Open edition" },
  { value: "AP",      label: "Artist's Proof (AP)" },
  { value: "proof",   label: "Proof" },
] as const;

interface Props {
  artworkId: string;
  initial: {
    title: string | null;
    medium: string | null;
    medium_category: string[] | null;
    surface_or_substrate: string | null;
    dimensions: string | null;
    year: number | null;
    edition: string | null;
    edition_number: number | null;
    edition_total: number | null;
    edition_type: string | null;
    location_text: string | null;
    show_location_publicly: boolean;
  };
}

export function WorkDetailsEditor({ artworkId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title ?? "");
  const [mediumCategory, setMediumCategory] = useState<string[]>(initial.medium_category ?? []);
  const [surfaceOrSubstrate, setSurfaceOrSubstrate] = useState(initial.surface_or_substrate ?? "");
  const [medium, setMedium] = useState(initial.medium ?? "");
  const [dimensions, setDimensions] = useState(initial.dimensions ?? "");
  const [year, setYear] = useState<string>(initial.year ? String(initial.year) : "");
  const [edition, setEdition] = useState(initial.edition ?? "");
  const [editionNumber, setEditionNumber] = useState<string>(initial.edition_number ? String(initial.edition_number) : "");
  const [editionTotal, setEditionTotal] = useState<string>(initial.edition_total ? String(initial.edition_total) : "");
  const [editionType, setEditionType] = useState(initial.edition_type ?? "");
  const [locationText, setLocationText] = useState(initial.location_text ?? "");
  const [showLocationPublicly, setShowLocationPublicly] = useState(initial.show_location_publicly);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest free-text medium from structured selections when field is empty
  useEffect(() => {
    if (medium) return;
    const suggestion = buildSuggestion(mediumCategory, surfaceOrSubstrate);
    if (suggestion) setMedium(suggestion);
  }, [mediumCategory, surfaceOrSubstrate]); // eslint-disable-line react-hooks/exhaustive-deps

  const filled = [title, medium, mediumCategory.length > 0 ? "x" : "", surfaceOrSubstrate, dimensions, year, edition, editionType, locationText].filter((v) => String(v).trim()).length;

  function toggleCategory(cat: string) {
    setMediumCategory((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateArtworkDetails({
      artworkId,
      title: title.trim() || null,
      medium: medium.trim() || null,
      medium_category: mediumCategory.length ? mediumCategory : null,
      surface_or_substrate: surfaceOrSubstrate.trim() || null,
      dimensions: dimensions.trim() || null,
      edition: edition.trim() || null,
      year: year.trim() ? parseInt(year, 10) : null,
      edition_number: editionNumber.trim() ? parseInt(editionNumber, 10) : null,
      edition_total: editionTotal.trim() ? parseInt(editionTotal, 10) : null,
      edition_type: editionType || null,
      location_text: locationText.trim() || null,
      show_location_publicly: showLocationPublicly,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    }
  }

  return (
    <section className="border border-stone-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-stone-900">Work details</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Title, medium, category, dimensions, year, edition, location — appear on the certificate and provenance page.{" "}
            <span className="text-stone-700">{filled}/9 filled</span>
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
        <form onSubmit={handleSave} className="border-t border-stone-100 px-5 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
            />
          </div>

          {/* Medium Category (multi-select) */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-2">Medium Category</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {MEDIUM_CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mediumCategory.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                    className="accent-black"
                  />
                  <span className="text-xs text-stone-700">{cat}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Surface / Substrate + Medium free-text */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Surface / Substrate</label>
              <select
                value={surfaceOrSubstrate}
                onChange={(e) => setSurfaceOrSubstrate(e.target.value)}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white"
              >
                <option value="">— optional —</option>
                {SURFACE_OPTIONS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Medium / Material</label>
              <input
                type="text"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                placeholder="e.g. Oil on canvas"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Year + Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={1500}
                max={new Date().getFullYear() + 1}
                placeholder={String(new Date().getFullYear())}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Dimensions</label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder="e.g. 600 × 400 mm"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Edition — free-text display value */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Edition</label>
            <input
              type="text"
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              placeholder="e.g. 1/25 or Original"
              className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
            />
          </div>

          {/* Structured edition fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Edition No.</label>
              <input
                type="number"
                value={editionNumber}
                onChange={(e) => setEditionNumber(e.target.value)}
                min={1}
                placeholder="e.g. 1"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Edition Total</label>
              <input
                type="number"
                value={editionTotal}
                onChange={(e) => setEditionTotal(e.target.value)}
                min={1}
                placeholder="e.g. 25"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Edition Type</label>
              <select
                value={editionType}
                onChange={(e) => setEditionType(e.target.value)}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white"
              >
                <option value="">— optional —</option>
                {EDITION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Location</label>
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="e.g. Auckland, NZ"
              className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLocationPublicly}
                onChange={(e) => setShowLocationPublicly(e.target.checked)}
                className="accent-black"
              />
              <span className="text-xs text-stone-600">Show location publicly</span>
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save details"}
            </button>
            {saved && <p className="text-xs text-emerald-600">Saved.</p>}
          </div>
        </form>
      )}
    </section>
  );
}
