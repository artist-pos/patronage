"use client";

import { useState, useTransition } from "react";
import { sendDigestAction, type DigestAudience } from "./actions";

const AUDIENCES: { key: DigestAudience; label: string; schedule: string }[] = [
  { key: "a", label: "Artists, half A", schedule: "Tuesday" },
  { key: "b", label: "Artists, half B", schedule: "Wednesday" },
  { key: "partner", label: "Organisations", schedule: "Tuesday" },
];

export function DigestControls({
  counts,
  total,
  hasResend,
  isEmpty,
}: {
  counts: Record<DigestAudience, number>;
  total: number;
  hasResend: boolean;
  isEmpty: boolean;
}) {
  const [confirming, setConfirming] = useState<DigestAudience | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(audience: DigestAudience) {
    startTransition(async () => {
      const res = await sendDigestAction(audience);
      setResult(res);
      setConfirming(null);
    });
  }

  return (
    <div className="space-y-4">
      <a
        href="/api/admin/subscribers"
        download
        className="inline-block border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
      >
        Export {total} subscriber{total !== 1 ? "s" : ""} (CSV)
      </a>

      {!hasResend ? (
        <p className="text-xs text-muted-foreground">
          Add <code className="font-mono">RESEND_API_KEY</code> and{" "}
          <code className="font-mono">RESEND_FROM</code> to enable sending.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The weekly cron sends these automatically on the days shown. Use a button to send one early or to re-send
            anyone held back by the daily email limit.
          </p>
          <div className="flex flex-wrap gap-3">
            {AUDIENCES.map(({ key, label, schedule }) =>
              confirming === key ? (
                <div key={key} className="flex items-center gap-3 border border-black px-4 py-2">
                  <p className="text-sm">
                    Send to <strong>{counts[key]}</strong>?
                  </p>
                  <button
                    onClick={() => setConfirming(null)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleConfirm(key)}
                    disabled={isPending}
                    className="border border-black bg-black text-white px-3 py-1 text-xs hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Sending…" : "Confirm & send"}
                  </button>
                </div>
              ) : (
                <button
                  key={key}
                  onClick={() => { setResult(null); setConfirming(key); }}
                  disabled={isEmpty || counts[key] === 0 || isPending}
                  className="border border-black px-4 py-2 text-left text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {label} · {counts[key].toLocaleString()}
                  <span className="block text-[11px] text-muted-foreground">Cron: {schedule}</span>
                </button>
              )
            )}
          </div>
          {result && (
            <p className={`text-sm ${result.ok ? "" : "text-destructive"}`}>{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
