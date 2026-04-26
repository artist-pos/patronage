"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateArtworkDetails } from "./actions";

interface Props {
  artworkId: string;
  initial: {
    title: string | null;
    medium: string | null;
    dimensions: string | null;
    year: number | null;
    edition: string | null;
  };
}

export function WorkDetailsEditor({ artworkId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title ?? "");
  const [medium, setMedium] = useState(initial.medium ?? "");
  const [dimensions, setDimensions] = useState(initial.dimensions ?? "");
  const [year, setYear] = useState<string>(initial.year ? String(initial.year) : "");
  const [edition, setEdition] = useState(initial.edition ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Completeness count drives the collapsed-state hint, so the artist sees at
  // a glance how many fields they've filled in without needing to expand.
  const filled = [title, medium, dimensions, year, edition].filter(v => v.trim()).length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateArtworkDetails({
      artworkId,
      title: title.trim() || null,
      medium: medium.trim() || null,
      dimensions: dimensions.trim() || null,
      edition: edition.trim() || null,
      year: year.trim() ? parseInt(year, 10) : null,
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
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-stone-900">Work details</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Title, medium, dimensions, year, edition — appear on the certificate and provenance page.{" "}
            <span className="text-stone-700">{filled}/5 filled</span>
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
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Untitled"
              className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Medium</label>
              <input
                type="text"
                value={medium}
                onChange={e => setMedium(e.target.value)}
                placeholder="e.g. Oil on canvas"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Year</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                min={1500}
                max={new Date().getFullYear() + 1}
                placeholder={String(new Date().getFullYear())}
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Dimensions</label>
              <input
                type="text"
                value={dimensions}
                onChange={e => setDimensions(e.target.value)}
                placeholder="e.g. 600 × 400 mm"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">Edition</label>
              <input
                type="text"
                value={edition}
                onChange={e => setEdition(e.target.value)}
                placeholder="e.g. 1/25 or Original"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
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
