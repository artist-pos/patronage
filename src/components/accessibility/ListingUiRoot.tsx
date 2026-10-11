"use client";

import { useState, useTransition } from "react";
import { Accessibility } from "lucide-react";
import { saveUiPrefs } from "@/app/ui-prefs-actions";
import type { UiPrefs } from "@/lib/ui-prefs";

export function ListingUiRoot({ initial, children }: { initial: UiPrefs; children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UiPrefs>(initial);
  const [, startTransition] = useTransition();

  function update(next: UiPrefs) {
    setPrefs(next); // instant; the save is in the background
    startTransition(async () => {
      await saveUiPrefs(next);
    });
  }

  return (
    <div
      className={`listing-ui${prefs.a11y ? " ams-comfort" : ""}`}
      data-a11y={prefs.a11y ? "on" : "off"}
      data-large={prefs.a11y && prefs.largeText ? "on" : "off"}
      data-motion={prefs.reduceMotion ? "reduce" : "normal"}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-x-5 gap-y-2 px-6 pt-3">
        {prefs.a11y && (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.largeText}
                onChange={(e) => update({ ...prefs, largeText: e.target.checked })}
                className="h-4 w-4"
              />
              Larger text
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.reduceMotion}
                onChange={(e) => update({ ...prefs, reduceMotion: e.target.checked })}
                className="h-4 w-4"
              />
              Reduce motion
            </label>
          </>
        )}
        <button
          type="button"
          aria-pressed={prefs.a11y}
          onClick={() => update({ ...prefs, a11y: !prefs.a11y })}
          className={`flex items-center gap-2 border px-3 py-1.5 text-sm font-medium transition-colors ${
            prefs.a11y
              ? "border-foreground bg-foreground text-background"
              : "border-border text-foreground hover:border-foreground"
          }`}
        >
          <Accessibility className="h-4 w-4" aria-hidden />
          Accessibility
        </button>
      </div>
      {children}
    </div>
  );
}
