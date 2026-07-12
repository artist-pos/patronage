"use client";

import { useState } from "react";
import { updateProfilePrivacy } from "@/app/profile/privacy-actions";

interface Props {
  initial: boolean;
}

export function PrivateSupporterToggle({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    const result = await updateProfilePrivacy("private_supporter", next);
    setSaving(false);
    if (result?.error) {
      setEnabled(!next);
      setToast(result.error);
    } else {
      setToast(next ? "Your profile is now private." : "Your profile is now public.");
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Private supporter</p>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Visitors see “Private supporter” instead of your name — your bio, links, and collection are hidden. The artists you follow stay visible."
            : "Mask your identity on your public profile. The artists you follow stay visible; your name, bio, links, and collection are hidden."}
        </p>
        {toast && <p className="text-xs text-muted-foreground mt-1">{toast}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={saving}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
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
