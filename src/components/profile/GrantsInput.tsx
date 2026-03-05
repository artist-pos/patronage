"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";

interface Props {
  initialGrants: string[];
  onSave: (grants: string[]) => Promise<void>;
}

export function GrantsInput({ initialGrants, onSave }: Props) {
  const [grants, setGrants] = useState<string[]>(initialGrants);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addGrant() {
    const trimmed = inputValue.trim();
    if (!trimmed || grants.includes(trimmed)) {
      setInputValue("");
      return;
    }
    const next = [...grants, trimmed];
    setGrants(next);
    setInputValue("");
    persist(next);
  }

  function removeGrant(grant: string) {
    const next = grants.filter((g) => g !== grant);
    setGrants(next);
    persist(next);
  }

  async function persist(next: string[]) {
    setSaving(true);
    try {
      await onSave(next);
      setToast("Saved");
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast("Save failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {grants.map((g) => (
          <span
            key={g}
            className="flex items-center gap-1 text-xs border border-black px-2 py-0.5 leading-none"
          >
            {g}
            <button
              type="button"
              onClick={() => removeGrant(g)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Remove ${g}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-0">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addGrant();
            }
          }}
          placeholder="Type a grant name and press Enter"
          className="flex-1 border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black"
        />
        <button
          type="button"
          onClick={addGrant}
          disabled={saving}
          className="border border-l-0 border-black px-3 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {toast && (
        <p className={`text-xs ${toast === "Saved" ? "text-green-600" : "text-destructive"}`}>
          {toast}
        </p>
      )}
    </div>
  );
}
