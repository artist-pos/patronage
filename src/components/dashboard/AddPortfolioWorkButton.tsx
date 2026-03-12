"use client";

import { useState } from "react";
import { NewArtworkEditor } from "@/components/dashboard/NewArtworkEditor";

export function AddPortfolioWorkButton({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="pt-4 border-t border-border">
        <NewArtworkEditor
          profileId={profileId}
          onCancel={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-border">
      <button
        onClick={() => setOpen(true)}
        className="text-sm border border-border px-4 py-2 hover:bg-muted/40 transition-colors"
      >
        + Add portfolio work
      </button>
    </div>
  );
}
