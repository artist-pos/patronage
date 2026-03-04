"use client";

import { useState } from "react";
import Image from "next/image";
import { approveOpportunity, rejectOpportunity, approveAll, rejectAll } from "./actions";
import type { Opportunity } from "@/types/database";

interface Props {
  opps: Opportunity[];
  tab: string;
}

export function QueueControls({ opps, tab }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setLoading(id);
    await approveOpportunity(id);
    setLoading(null);
  }

  async function handleReject(id: string) {
    setLoading(`reject-${id}`);
    await rejectOpportunity(id);
    setLoading(null);
  }

  async function handleApproveAll() {
    setLoading("all");
    await approveAll(opps.map((o) => o.id));
    setLoading(null);
  }

  async function handleRejectAll() {
    setLoading("reject-all");
    await rejectAll(opps.map((o) => o.id));
    setLoading(null);
  }

  if (opps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {tab === "pending" ? "Queue is empty — run the scraper to populate it." : "No rejected items."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {tab === "pending" && opps.length > 1 && (
        <div className="flex gap-3 text-xs">
          <button
            onClick={handleApproveAll}
            disabled={loading === "all"}
            className="border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
          >
            {loading === "all" ? "Approving…" : `Approve all ${opps.length}`}
          </button>
          <button
            onClick={handleRejectAll}
            disabled={loading === "reject-all"}
            className="border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {loading === "reject-all" ? "Rejecting…" : "Reject all"}
          </button>
        </div>
      )}

      {/* Items */}
      <div className="space-y-px">
        {opps.map((opp) => (
          <div
            key={opp.id}
            className="flex items-start gap-4 border border-border p-3 bg-background hover:bg-muted/30 transition-colors"
          >
            {/* Thumbnail */}
            <div className="w-16 h-16 shrink-0 bg-muted border border-border overflow-hidden flex items-center justify-center">
              {opp.featured_image_url ? (
                <Image
                  src={opp.featured_image_url}
                  alt={opp.title}
                  width={64}
                  height={64}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-muted-foreground text-center px-1 leading-tight">
                  No image
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-sm font-semibold leading-snug line-clamp-2">{opp.title}</p>
              <p className="text-xs text-muted-foreground">{opp.organiser}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-[10px] border border-border px-1.5 py-0.5 leading-none">{opp.type}</span>
                <span className="text-[10px] border border-border px-1.5 py-0.5 leading-none">{opp.country}</span>
                {opp.deadline && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Closes {opp.deadline}
                  </span>
                )}
                {opp.funding_range && (
                  <span className="text-[10px] font-mono font-bold">{opp.funding_range}</span>
                )}
              </div>
              {opp.caption && (
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-1">
                  {opp.caption}
                </p>
              )}
              {opp.source_url && (
                <a
                  href={opp.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {new URL(opp.source_url).hostname}
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 shrink-0">
              {tab === "pending" ? (
                <>
                  <button
                    onClick={() => handleApprove(opp.id)}
                    disabled={loading === opp.id}
                    className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    {loading === opp.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => handleReject(opp.id)}
                    disabled={loading === `reject-${opp.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {loading === `reject-${opp.id}` ? "…" : "Reject"}
                  </button>
                  {opp.url && (
                    <a
                      href={opp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center"
                    >
                      View →
                    </a>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleApprove(opp.id)}
                  disabled={loading === opp.id}
                  className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                >
                  {loading === opp.id ? "…" : "Restore"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
