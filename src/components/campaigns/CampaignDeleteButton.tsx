"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCampaign } from "@/app/studio/campaigns/actions";

interface Props {
  campaignId: string;
}

export function CampaignDeleteButton({ campaignId }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteCampaign(campaignId);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Delete campaign?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-[11px] text-red-600 hover:text-red-700 font-medium disabled:opacity-40 transition-colors"
        >
          {deleting ? "Deleting…" : "Confirm"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[11px] text-muted-foreground hover:text-red-600 transition-colors"
    >
      Delete
    </button>
  );
}
