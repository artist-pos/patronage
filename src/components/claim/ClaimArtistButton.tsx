"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimArtistStub } from "@/app/claim/artist/[token]/actions";

interface Props {
  token: string;
}

export function ClaimArtistButton({ token }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClaim() {
    setError(null);
    setNeedsReview(false);
    startTransition(async () => {
      const result = await claimArtistStub(token);
      if (result.needsAdminReview) {
        setNeedsReview(true);
        setError(result.error ?? null);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/studio/pending-confirmations");
    });
  }

  if (needsReview) {
    return (
      <div className="border border-amber-200 rounded-lg p-6 bg-amber-50 space-y-3 text-sm">
        <p className="font-medium">Email mismatch — manual review needed</p>
        <p>
          {error ??
            "Your email doesn't match the one on file. Contact Patronage and we'll verify it manually."}
        </p>
        <a
          href="mailto:hello@patronage.nz?subject=Artist%20claim%20review"
          className="inline-block underline text-stone-700 hover:text-stone-900"
        >
          Email Patronage →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClaim}
        disabled={isPending}
        className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {isPending ? "Claiming…" : "Yes, this is me — claim these records"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
