"use client";

import { useEffect, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import {
  getClaimOwners,
  resetClaimState,
  type ClaimOwnerInfo,
} from "@/app/admin/opportunities/actions";
import type { Opportunity } from "@/types/database";

interface Props {
  opps: Opportunity[];
  onClose: () => void;
  /** `tokens` maps opportunity id → the freshly issued claim token. */
  onDone: (msg: string, tokens: Record<string, string>) => void;
}

export function ResetClaimDialog({ opps, onClose, onDone }: Props) {
  const [owners, setOwners] = useState<ClaimOwnerInfo[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ids = opps.map((o) => o.id).join(",");

  useEffect(() => {
    let cancelled = false;
    getClaimOwners(ids.split(",")).then((result) => {
      if (!cancelled) setOwners(result);
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  async function handleReset() {
    setRunning(true);
    setError(null);

    const results = await Promise.all(
      opps.map((o) => resetClaimState(o.id).then((r) => ({ id: o.id, ...r })))
    );
    const failed = results.filter((r) => r.error).length;

    setRunning(false);
    if (failed > 0) {
      setError(`${failed} of ${opps.length} couldn't be reset.`);
      return;
    }

    const tokens = Object.fromEntries(
      results.filter((r) => r.claim_token).map((r) => [r.id, r.claim_token as string])
    );
    onDone(
      `${opps.length} listing${opps.length !== 1 ? "s" : ""} reset to unclaimed — fresh claim link${opps.length !== 1 ? "s" : ""} issued.`,
      tokens
    );
  }

  const ownedCount = owners?.filter((o) => o.ownerLabel).length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border border-black w-full max-w-lg mx-4 shadow-lg">
        <div className="flex items-start justify-between px-5 py-4 border-b border-black/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5">
              Reset claim state
            </p>
            <p className="text-xs text-muted-foreground">
              {opps.length} listing{opps.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each listing goes back to unclaimed: the owner is removed, the link-open tracking is
            cleared, and a fresh claim token is issued — <strong>any link already sent for these
            listings stops working</strong>. Invite history is kept.
          </p>

          {owners === null ? (
            <p className="text-xs text-muted-foreground py-2">Checking current owners…</p>
          ) : (
            <div className="border border-border divide-y divide-border max-h-64 overflow-y-auto">
              {owners.map((o) => (
                <div key={o.id} className="px-3 py-2 flex items-start justify-between gap-3">
                  <span className="text-xs line-clamp-1">{o.title}</span>
                  {o.ownerLabel ? (
                    <span className="text-[11px] text-amber-700 shrink-0">
                      Owned by {o.ownerLabel}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {o.opened ? "Opened, no owner" : "Nothing to reset"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {ownedCount > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {ownedCount} listing{ownedCount !== 1 ? "s have" : " has"} a real owner. Resetting
              removes their access to manage the listing — check these aren&rsquo;t genuine partner
              claims first.
            </p>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-black/20">
          <button
            type="button"
            onClick={onClose}
            className="text-xs border border-black/40 px-3 py-2 hover:border-black transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={running || owners === null}
            onClick={handleReset}
            className="text-xs bg-black text-white px-4 py-2 hover:bg-black/80 transition-colors disabled:opacity-50"
          >
            {running ? "Resetting…" : `Reset ${opps.length} listing${opps.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
