"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { GrantReport } from "@/lib/admin";

export default function GrantReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<GrantReport | null | "loading">("loading");

  useEffect(() => {
    fetch(`/api/admin/grant-report?id=${id}`)
      .then((r) => r.json())
      .then((data) => setReport(data.report ?? null));
  }, [id]);

  if (report === "loading") {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">Loading report…</div>
    );
  }

  if (!report) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Report not found. The opportunity may be inactive.
      </div>
    );
  }

  const { opportunity: opp, last30, allTime } = report;
  const generated = new Date().toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <p className="text-xs text-muted-foreground">Partner Performance Report</p>
        <button
          onClick={() => window.print()}
          className="text-xs border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Report body */}
      <div className="max-w-2xl space-y-10 print:max-w-none">

        {/* Header */}
        <div className="space-y-1 border-b border-black pb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest print:text-black">
            Patronage — Partner Performance Report
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{opp.title}</h1>
          <p className="text-sm text-muted-foreground">{opp.organiser}</p>
          <p className="text-xs text-muted-foreground">Generated {generated}</p>
        </div>

        {/* Summary sentence */}
        <div className="border border-black p-6 space-y-2">
          <p className="text-sm leading-relaxed">
            <strong>{opp.title}</strong> by <strong>{opp.organiser}</strong> received{" "}
            <strong>{last30.engagements.toLocaleString()} engagements</strong> and{" "}
            <strong>{last30.clicks.toLocaleString()} direct click-throughs</strong> from
            verified artists on Patronage over the last 30 days.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-black p-5 space-y-1">
            <p className="text-3xl font-bold tabular-nums">{last30.engagements.toLocaleString()}</p>
            <p className="text-xs font-medium uppercase tracking-widest">Read More (30 days)</p>
            <p className="text-xs text-muted-foreground">Visitors who expanded the full description</p>
          </div>
          <div className="border border-black p-5 space-y-1">
            <p className="text-3xl font-bold tabular-nums">{last30.clicks.toLocaleString()}</p>
            <p className="text-xs font-medium uppercase tracking-widest">Click-throughs (30 days)</p>
            <p className="text-xs text-muted-foreground">Visitors sent to the grant website</p>
          </div>
          <div className="border border-border p-5 space-y-1">
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{allTime.engagements.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">All-time engagements</p>
          </div>
          <div className="border border-border p-5 space-y-1">
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{allTime.clicks.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">All-time click-throughs</p>
          </div>
        </div>

        {/* Grant details */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Listing Details
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {opp.type && (
              <>
                <span className="text-muted-foreground">Type</span>
                <span>{opp.type}</span>
              </>
            )}
            {opp.country && (
              <>
                <span className="text-muted-foreground">Country</span>
                <span>{opp.country}</span>
              </>
            )}
            {(opp.funding_range || opp.funding_amount) && (
              <>
                <span className="text-muted-foreground">Funding</span>
                <span className="font-mono font-semibold">
                  {opp.funding_range ?? `$${opp.funding_amount?.toLocaleString("en-NZ")}`}
                </span>
              </>
            )}
            {opp.deadline && (
              <>
                <span className="text-muted-foreground">Deadline</span>
                <span>
                  {new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-6 text-xs text-muted-foreground print:text-black">
          <p>Patronage — patronage.nz</p>
          <p>This report is confidential and intended for the named partner only.</p>
        </div>
      </div>
    </>
  );
}
