"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConnectAccountLink } from "./actions";

interface Props {
  currentStatus: string | null;
}

export function ConnectForm({ currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConnect() {
    startTransition(async () => {
      const result = await createConnectAccountLink();
      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        alert(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {currentStatus === "pending" && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-800">
          Your Stripe account is set up but not fully verified yet. Complete onboarding to enable automatic payouts.
        </div>
      )}

      <button
        type="button"
        onClick={handleConnect}
        disabled={isPending}
        className="w-full sm:w-auto px-5 py-2.5 bg-black text-white text-sm rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {isPending
          ? "Redirecting to Stripe…"
          : currentStatus === "pending"
          ? "Complete Stripe onboarding →"
          : "Connect bank account →"}
      </button>

      <p className="text-xs text-muted-foreground">
        You will be redirected to Stripe to complete setup. Return here when done.
      </p>
    </div>
  );
}
