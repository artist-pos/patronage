"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConnectAccountLink, disconnectConnectAccount } from "./actions";

interface Props {
  currentStatus: string | null;
}

export function ConnectForm({ currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
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

  function handleDisconnect() {
    startDisconnect(async () => {
      const result = await disconnectConnectAccount();
      if (result.error) {
        alert(result.error);
      } else {
        router.refresh();
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
        disabled={isPending || isDisconnecting}
        className="w-full sm:w-auto px-5 py-2.5 bg-black text-white text-sm rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {isPending
          ? "Redirecting to Stripe…"
          : currentStatus === "pending"
          ? "Complete Stripe onboarding →"
          : "Connect bank account →"}
      </button>

      {currentStatus === "pending" && (
        <div className="pt-2 border-t border-stone-100">
          <p className="text-xs text-muted-foreground mb-2">
            Connected to the wrong account? Reset and start fresh.
          </p>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isPending || isDisconnecting}
            className="text-xs text-stone-500 hover:text-red-600 underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            {isDisconnecting ? "Resetting…" : "Reset Stripe connection"}
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        You will be redirected to Stripe to complete setup. Return here when done.
      </p>
    </div>
  );
}
