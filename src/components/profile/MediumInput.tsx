"use client";

import { useState } from "react";

const MEDIUMS = [
  "Painting",
  "Sculpture",
  "Photography",
  "Public Art",
  "Installation",
  "Film / Video",
  "Poetry / Literature",
  "Music / Sound",
  "Performance",
  "Digital Art",
  "Textiles",
  "Ceramics",
];

interface Props {
  defaultValue?: string[];
}

export function MediumInput({ defaultValue = [] }: Props) {
  // Normalise stored values so existing free-text entries still match tiles
  const [selected, setSelected] = useState<string[]>(defaultValue);

  function toggle(medium: string) {
    setSelected((prev) =>
      prev.includes(medium) ? prev.filter((m) => m !== medium) : [...prev, medium]
    );
  }

  return (
    <div className="space-y-3">
      {/* Hidden field carries comma-separated values to the server action */}
      <input type="hidden" name="medium" value={selected.join(",")} />

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {MEDIUMS.map((m) => {
          const active = selected.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              className={`relative flex flex-col items-center justify-center text-center px-2 py-3 border text-xs leading-snug transition-colors select-none ${
                active
                  ? "border-black bg-black text-white"
                  : "border-border bg-background text-foreground hover:border-black hover:bg-muted"
              }`}
            >
              {active && (
                <span className="absolute top-1.5 right-1.5 text-[10px] leading-none">✓</span>
              )}
              {m}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected: {selected.join(", ")}
        </p>
      )}
    </div>
  );
}
