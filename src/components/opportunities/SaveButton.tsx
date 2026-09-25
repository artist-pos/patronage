"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { toggleSaveOpportunity } from "@/app/dashboard/actions";
import { UnauthSaveModal } from "./UnauthSaveModal";
import { trackEvent } from "@/lib/analytics";

interface Props {
  opportunityId: string;
  initialSaved: boolean;
  saveCount?: number;
  showCount?: boolean;
  isAuthenticated?: boolean;
  /** "icon" (default): bare bookmark for cards. "button": labelled, for the detail page action bar. */
  variant?: "icon" | "button";
  /** Class for the "button" variant, so it can match its neighbours. */
  className?: string;
}

export function SaveButton({ opportunityId, initialSaved, saveCount = 0, showCount = false, isAuthenticated = false, variant = "icon", className }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(saveCount);
  const [pending, setPending] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  async function handleToggle() {
    // "detail" is the labelled button on the opportunity page; "card" the
    // bookmark on grid cards — so the two placements can be compared.
    const placement = variant === "button" ? "detail" : "card";
    if (!isAuthenticated) {
      trackEvent("opportunity_save_click", { opportunity_id: opportunityId, action: "prompt", placement });
      setShowPrompt(true);
      return;
    }
    if (pending) return;
    setPending(true);
    // Optimistic
    const nowSaved = !saved;
    trackEvent("opportunity_save_click", {
      opportunity_id: opportunityId,
      action: nowSaved ? "save" : "unsave",
      placement,
    });
    setSaved(nowSaved);
    setCount((c) => nowSaved ? c + 1 : Math.max(0, c - 1));
    const result = await toggleSaveOpportunity(opportunityId);
    // Reconcile if server disagrees
    if (result.saved !== nowSaved) {
      setSaved(result.saved);
      setCount((c) => result.saved ? c + 1 : Math.max(0, c - 1));
    }
    setPending(false);
  }

  if (variant === "button") {
    return (
      <>
        {showPrompt && <UnauthSaveModal onClose={() => setShowPrompt(false)} />}
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          aria-pressed={saved}
          className={`${className ?? ""} disabled:opacity-50`}
        >
          <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} aria-hidden />
          <span className="max-sm:sr-only">{saved ? "Saved" : "Save"}</span>
        </button>
      </>
    );
  }

  return (
    <>
      {showPrompt && <UnauthSaveModal onClose={() => setShowPrompt(false)} />}
      <button
        onClick={handleToggle}
        disabled={pending}
        title={saved ? "Remove from saved" : "Save opportunity"}
        className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
          saved
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Bookmark
          className="w-4 h-4"
          fill={saved ? "currentColor" : "none"}
        />
        {showCount && count > 0 && (
          <span className="tabular-nums">{count}</span>
        )}
      </button>
    </>
  );
}
