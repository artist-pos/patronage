"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAcquisitionMode } from "./actions";

type AcquisitionMode = "buy_now" | "make_offer" | "enquire_first";

const OPTIONS: { value: AcquisitionMode; label: string; description: string }[] = [
  {
    value: "buy_now",
    label: "Buy",
    description: "Shows price and a Buy button. Enables direct purchase.",
  },
  {
    value: "make_offer",
    label: "Make an Offer",
    description: "Shows price and an offer button. Buyer proposes a price.",
  },
  {
    value: "enquire_first",
    label: "Enquire about this work",
    description: "Price is hidden. Buyer contacts you to start a conversation.",
  },
];

interface Props {
  artworkId: string;
  initialMode: AcquisitionMode;
}

export function AcquisitionModeEditor({ artworkId, initialMode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AcquisitionMode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateAcquisitionMode(artworkId, mode);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    }
  }

  const currentLabel = OPTIONS.find((o) => o.value === mode)?.label ?? mode;

  return (
    <section className="border border-stone-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-stone-900">Acquisition mode</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Controls the single CTA button shown on the public artwork page.{" "}
            <span className="text-stone-700">Currently: {currentLabel}</span>
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
        <div className="border-t border-stone-100 px-5 py-5 space-y-4">
          <div className="space-y-2">
            {OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mode === opt.value
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <input
                  type="radio"
                  name="acquisition_mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="mt-0.5 accent-black"
                />
                <div>
                  <p className="text-sm font-medium text-stone-900">{opt.label}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <p className="text-xs text-emerald-600">Saved.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
