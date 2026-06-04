"use client";

import { useState } from "react";
import { updateProfilePrivacy } from "@/app/profile/privacy-actions";

export function HideBlogCardToggle({ hidden }: { hidden: boolean }) {
  const [isHidden, setIsHidden] = useState(hidden);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const next = !isHidden;
    const result = await updateProfilePrivacy("hide_blog_card", next);
    setSaving(false);
    if (!result.error) setIsHidden(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2 disabled:opacity-50"
    >
      {saving ? "Saving…" : isHidden ? "Show on profile" : "Hide from profile"}
    </button>
  );
}
