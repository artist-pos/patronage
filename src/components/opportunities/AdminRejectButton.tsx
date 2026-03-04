"use client";

import { useState } from "react";
import { rejectOpportunityAdmin } from "@/app/opportunities/[id]/actions";

export function AdminRejectButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleReject() {
    setPending(true);
    await rejectOpportunityAdmin(id);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Reject this opportunity?</span>
        <button
          onClick={handleReject}
          disabled={pending}
          className="text-xs border border-black bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {pending ? "Rejecting…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
    >
      Reject
    </button>
  );
}
