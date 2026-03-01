"use client";

import { useState, useTransition } from "react";
import { sendDigestAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DigestControls({
  subscriberCount,
  hasResend,
}: {
  subscriberCount: number;
  hasResend: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSend() {
    startTransition(async () => {
      const res = await sendDigestAction();
      setResult(res);
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

      {hasResend ? (
        <Button onClick={handleSend} disabled={isPending}>
          {isPending ? "Sending…" : "Send digest now"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Add <code className="font-mono">RESEND_API_KEY</code> and{" "}
          <code className="font-mono">RESEND_FROM</code> to enable sending.
        </p>
      )}

      {result && (
        <p className={`text-sm ${result.ok ? "" : "text-destructive"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
