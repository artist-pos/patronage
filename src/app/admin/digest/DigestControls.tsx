"use client";

import { useState, useTransition } from "react";
import { sendDigestAction } from "./actions";

export function DigestControls({
  subscriberCount,
  hasResend,
  isEmpty,
}: {
  subscriberCount: number;
  hasResend: boolean;
  isEmpty: boolean;
}) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const res = await sendDigestAction();
      setResult(res);
      setStep("done");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <a
        href="/api/admin/subscribers"
        download
        className="border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
      >
        Export {subscriberCount} subscriber{subscriberCount !== 1 ? "s" : ""} (CSV)
      </a>

      {!hasResend ? (
        <p className="text-xs text-muted-foreground">
          Add <code className="font-mono">RESEND_API_KEY</code> and{" "}
          <code className="font-mono">RESEND_FROM</code> to enable sending.
        </p>
      ) : step === "idle" ? (
        <button
          onClick={() => setStep("confirm")}
          disabled={isEmpty || subscriberCount === 0}
          className="border border-black bg-black text-white px-4 py-2 text-sm hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send to {subscriberCount.toLocaleString()} subscriber{subscriberCount !== 1 ? "s" : ""} →
        </button>
      ) : step === "confirm" ? (
        <div className="flex items-center gap-3 border border-black px-4 py-2">
          <p className="text-sm">
            Send digest to <strong>{subscriberCount.toLocaleString()} subscriber{subscriberCount !== 1 ? "s" : ""}</strong>?
          </p>
          <button
            onClick={() => setStep("idle")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="border border-black bg-black text-white px-3 py-1 text-xs hover:bg-white hover:text-black transition-colors disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Confirm & send"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className={`text-sm ${result?.ok ? "" : "text-destructive"}`}>
            {result?.message}
          </p>
          <button
            onClick={() => { setStep("idle"); setResult(null); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
