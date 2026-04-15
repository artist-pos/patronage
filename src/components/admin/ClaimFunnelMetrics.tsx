"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FunnelData {
  sent: number;
  opened: number;
  claimed: number;
  pipelineActivated: number;
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function ClaimFunnelMetrics({ data }: { data: FunnelData }) {
  const [open, setOpen] = useState(false);

  const { sent, opened, claimed, pipelineActivated } = data;

  const summary = sent === 0
    ? "No claim invites sent yet"
    : `${sent} sent · ${pct(opened, sent)} opened · ${pct(claimed, sent)} claimed`;

  return (
    <div className="border border-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-widest text-muted-foreground">
            Claim outreach
          </span>
          <span className="text-muted-foreground">{summary}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FunnelCard
              label="Invites sent"
              value={sent}
              pctLabel={null}
            />
            <FunnelCard
              label="Links opened"
              value={opened}
              pctLabel={pct(opened, sent)}
            />
            <FunnelCard
              label="Listings claimed"
              value={claimed}
              pctLabel={pct(claimed, opened)}
            />
            <FunnelCard
              label="Pipeline activated"
              value={pipelineActivated}
              pctLabel={pct(pipelineActivated, claimed)}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Percentages show conversion from previous step: opened/sent → claimed/opened → pipeline/claimed.
          </p>
        </div>
      )}
    </div>
  );
}

function FunnelCard({
  label,
  value,
  pctLabel,
}: {
  label: string;
  value: number;
  pctLabel: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {pctLabel && (
        <p className="text-xs font-medium text-muted-foreground">{pctLabel} of previous</p>
      )}
    </div>
  );
}
