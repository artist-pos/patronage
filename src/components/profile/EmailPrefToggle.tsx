"use client";

import { useState } from "react";

interface Props {
  initial: boolean;
  title: string;
  onCopy: string;
  offCopy: string;
  onToast: string;
  offToast: string;
  save: (enabled: boolean) => Promise<{ error?: string }>;
}

/** A labelled on/off switch for one email preference. */
export function EmailPrefToggle({ initial, title, onCopy, offCopy, onToast, offToast, save }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    const result = await save(next);
    setSaving(false);
    if (result?.error) {
      setEnabled(!next);
      setToast(result.error);
    } else {
      setToast(next ? onToast : offToast);
    }
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{enabled ? onCopy : offCopy}</p>
        {toast && <p className="mt-1 text-xs text-muted-foreground">{toast}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        onClick={toggle}
        disabled={saving}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          enabled ? "bg-black" : "bg-stone-200",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            enabled ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
