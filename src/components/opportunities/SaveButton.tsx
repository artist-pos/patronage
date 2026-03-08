"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { toggleSaveOpportunity } from "@/app/dashboard/actions";
import { UnauthSaveModal } from "./UnauthSaveModal";

interface Props {
  opportunityId: string;
  initialSaved: boolean;
  saveCount?: number;
  showCount?: boolean;
  isAuthenticated?: boolean;
}

export function SaveButton({ opportunityId, initialSaved, saveCount = 0, showCount = false, isAuthenticated = false }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(saveCount);
  const [pending, setPending] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  async function handleToggle() {
    if (!isAuthenticated) {
      setShowPrompt(true);
      return;
    }
    if (pending) return;
    setPending(true);
    // Optimistic
    const nowSaved = !saved;
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
