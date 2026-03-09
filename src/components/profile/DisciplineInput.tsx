"use client";

import { useState } from "react";
import type { DisciplineEnum } from "@/types/database";

export const DISCIPLINE_OPTIONS: { value: DisciplineEnum; label: string }[] = [
  { value: "visual_art",  label: "Visual Art" },
  { value: "music",       label: "Music" },
  { value: "photography", label: "Photography" },
  { value: "film",        label: "Film" },
  { value: "writing",     label: "Writing" },
  { value: "poetry",      label: "Poetry" },
  { value: "dance",       label: "Dance" },
  { value: "performance", label: "Performance" },
  { value: "craft",       label: "Craft" },
  { value: "other",       label: "Other" },
];

// Maps enum value → human label used for the legacy `medium` field
const DISCIPLINE_TO_MEDIUM: Record<DisciplineEnum, string> = {
  visual_art:  "Visual Art",
  music:       "Music / Sound",
  photography: "Photography",
  film:        "Film / Video",
  writing:     "Writing",
  poetry:      "Poetry",
  dance:       "Dance",
  performance: "Performance",
  craft:       "Craft",
  other:       "Other",
};

interface Props {
  defaultValue?: DisciplineEnum[];
}

export function DisciplineInput({ defaultValue = [] }: Props) {
  const [selected, setSelected] = useState<DisciplineEnum[]>(defaultValue);

  function toggle(d: DisciplineEnum) {
    setSelected((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  // Produce the legacy medium string for backward compatibility
  const mediumValue = selected.map((d) => DISCIPLINE_TO_MEDIUM[d]).join(",");

  return (
    <div className="space-y-3">
      {/* Hidden inputs: disciplines (new enum) + medium (legacy free-text) */}
      <input type="hidden" name="disciplines" value={selected.join(",")} />
      <input type="hidden" name="medium" value={mediumValue} />

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {DISCIPLINE_OPTIONS.map(({ value, label }) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className={`relative flex flex-col items-center justify-center text-center px-2 py-3 border text-xs leading-snug transition-colors select-none ${
                active
                  ? "border-black bg-black text-white"
                  : "border-border bg-background text-foreground hover:border-black hover:bg-muted"
              }`}
            >
              {active && (
                <span className="absolute top-1.5 right-1.5 text-[10px] leading-none">✓</span>
              )}
              {label}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected: {selected.map((d) => DISCIPLINE_TO_MEDIUM[d]).join(", ")}
        </p>
      )}
    </div>
  );
}
