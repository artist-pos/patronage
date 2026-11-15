"use client";

import { useState, useTransition } from "react";
import { resolveReport } from "./actions";

export function ReportButtons({ reportId }: { reportId: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(action: "hide" | "keep") {
    setError(null);
    startTransition(async () => {
      const res = await resolveReport(reportId, action);
      if (res.error) setError(res.error);
      else setDone(action === "hide" ? "Hidden" : "Kept");
    });
  }

  if (done) return <span className="font-mono text-xs text-[color:var(--fg-muted)]">{done}</span>;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" disabled={pending} onClick={() => act("hide")} className="btn btn-primary btn-sm">Hide it</button>
      <button type="button" disabled={pending} onClick={() => act("keep")} className="btn btn-ghost btn-sm">Keep it</button>
      {error && <span role="alert" className="text-xs text-[color:var(--urgent)]">{error}</span>}
    </div>
  );
}
