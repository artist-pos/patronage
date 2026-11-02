"use client";

import { useState, useTransition } from "react";
import { reviewTip } from "@/actions/outcomes";

export function TipReviewButtons({ opportunityId, userId }: { opportunityId: string; userId: string }) {
  const [done, setDone] = useState<"approved" | "hidden" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function review(status: "approved" | "hidden") {
    startTransition(async () => {
      const res = await reviewTip(opportunityId, userId, status);
      if (res.error) return setError(res.error);
      setDone(status);
    });
  }

  if (done) return <span className="font-mono text-xs text-muted-foreground">{done === "approved" ? "Approved" : "Hidden"}</span>;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => review("approved")}
        disabled={pending}
        className="h-8 rounded-lg bg-foreground px-3 text-xs text-background disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => review("hidden")}
        disabled={pending}
        className="h-8 border border-border px-3 text-xs hover:border-foreground disabled:opacity-50"
      >
        Hide
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
