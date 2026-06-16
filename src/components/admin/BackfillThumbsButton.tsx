"use client";

import { useState } from "react";

// Drives POST /api/admin/backfill-thumbs in batches until every image has a
// stored thumbnail. Idempotent and resumable — safe to re-run or interrupt.
export function BackfillThumbsButton() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setStatus("Starting…");
    let processed = 0;
    let failed = 0;
    let aborted = false;
    try {
      let remaining = Infinity;
      while (remaining > 0) {
        const res = await fetch("/api/admin/backfill-thumbs?limit=100", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? `Request failed (${res.status})`);
          aborted = true;
          break;
        }
        processed += json.processed ?? 0;
        failed += json.failed ?? 0;
        remaining = json.remaining ?? 0;
        setStatus(`Processed ${processed} · ${remaining} remaining${failed ? ` · ${failed} skipped` : ""}`);
      }
      if (!aborted) {
        setStatus(`✓ Complete — ${processed} thumbnail${processed === 1 ? "" : "s"} generated${failed ? `, ${failed} skipped` : ""}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border border-border p-4 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Backfill image thumbnails</p>
          <p className="text-xs text-muted-foreground">
            Generates a stored thumbnail for existing portfolio works and studio
            updates that don&apos;t have one yet. Safe to run repeatedly.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="shrink-0 text-sm px-4 py-2 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {running ? "Backfilling…" : "Run backfill"}
        </button>
      </div>
      {status && <p className="text-xs text-muted-foreground font-mono">{status}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
