"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { markInCollection } from "@/app/profile/collection-actions";

interface Props {
  artworkId: string;
  artworkTitle: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LABEL_SUGGESTIONS = [
  "Private Collection",
  "NFS",
  "Artist's Collection",
];

export function PlaceInCollectionModal({ artworkId, artworkTitle, onClose, onSuccess }: Props) {
  const [label, setLabel] = useState("");
  const [patronUsername, setPatronUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    const result = await markInCollection(artworkId, label, patronUsername || undefined);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      onSuccess();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm border border-black bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black px-5 py-3">
          <h2 className="text-sm font-semibold">Mark as Collected</h2>
          <button onClick={onClose} aria-label="Close" className="hover:opacity-60 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {artworkTitle && (
            <p className="text-xs text-muted-foreground">
              Work: <span className="font-medium text-foreground">{artworkTitle}</span>
            </p>
          )}

          {/* Collection label */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" htmlFor="col-label">
              Collection label <span className="text-red-500">*</span>
            </label>
            <input
              id="col-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Private Collection"
              required
              maxLength={200}
              className="w-full border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:border-foreground"
            />
            {/* Quick-fill suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {LABEL_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLabel(s)}
                  className="text-[11px] border border-border px-2 py-0.5 hover:border-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Optional patron username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" htmlFor="col-patron">
              Patron username <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="col-patron"
              type="text"
              value={patronUsername}
              onChange={(e) => setPatronUsername(e.target.value.replace(/^@/, ""))}
              placeholder="username (without @)"
              className="w-full border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:border-foreground"
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              If this is a Patronage user, they&apos;ll receive a verification request to confirm the work is in their collection.
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim()}
              className="flex-1 bg-black text-white py-2 text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
