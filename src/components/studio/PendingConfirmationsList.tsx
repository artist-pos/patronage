"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  resolveClaim,
  resolveClaimsByHolder,
} from "@/app/studio/pending-confirmations/actions";
import type { PendingConfirmation } from "@/lib/pending-confirmations";

interface Props {
  confirmations: PendingConfirmation[];
}

interface HolderGroup {
  holderId: string;
  holderName: string;
  holderUsername: string;
  holderAvatar: string | null;
  rows: PendingConfirmation[];
}

export function PendingConfirmationsList({ confirmations }: Props) {
  // Group by holder so the bulk "confirm all from this holder" action lines
  // up with how a real artist will read the list — many works from one
  // collector, not a flat list to chew through one by one.
  const grouped = useMemo<HolderGroup[]>(() => {
    const map = new Map<string, HolderGroup>();
    for (const c of confirmations) {
      const existing = map.get(c.holder.id);
      if (existing) {
        existing.rows.push(c);
      } else {
        map.set(c.holder.id, {
          holderId: c.holder.id,
          holderName: c.holder.full_name ?? c.holder.username,
          holderUsername: c.holder.username,
          holderAvatar: c.holder.avatar_url,
          rows: [c],
        });
      }
    }
    return Array.from(map.values());
  }, [confirmations]);

  const [resolvedClaims, setResolvedClaims] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markResolved(claimIds: string[]) {
    setResolvedClaims((prev) => {
      const next = new Set(prev);
      for (const id of claimIds) next.add(id);
      return next;
    });
  }

  function handleSingle(claimId: string, decision: "confirmed" | "declined" | "unknown") {
    setError(null);
    // Optimistic — hide immediately, restore on failure.
    markResolved([claimId]);
    startTransition(async () => {
      const result = await resolveClaim(claimId, decision);
      if (result.error) {
        setResolvedClaims((prev) => {
          const next = new Set(prev);
          next.delete(claimId);
          return next;
        });
        setError(result.error);
      }
    });
  }

  function handleBulkFromHolder(group: HolderGroup, decision: "confirmed" | "declined" | "unknown") {
    if (!confirm(
      `${decision === "confirmed" ? "Confirm" : decision === "declined" ? "Decline" : "Skip"} all ${group.rows.length} work${group.rows.length === 1 ? "" : "s"} from ${group.holderName}?`,
    )) {
      return;
    }
    setError(null);
    const ids = group.rows.map((r) => r.claim.id);
    markResolved(ids);
    startTransition(async () => {
      const result = await resolveClaimsByHolder(group.holderId, decision);
      if (result.error) {
        // Pull back any rows that didn't resolve — best-effort UX, the
        // server tells us how many landed.
        if (result.resolved < ids.length) {
          setResolvedClaims((prev) => {
            const next = new Set(prev);
            for (const id of ids.slice(result.resolved)) next.delete(id);
            return next;
          });
        }
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-10">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      {grouped.map((group) => {
        const visibleRows = group.rows.filter((r) => !resolvedClaims.has(r.claim.id));
        if (visibleRows.length === 0) return null;
        return (
          <section key={group.holderId} className="space-y-4">
            <header className="flex flex-wrap items-center gap-3 justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-3">
                {group.holderAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.holderAvatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-stone-200" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    <Link
                      href={`/${group.holderUsername}`}
                      className="hover:underline"
                    >
                      {group.holderName}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {visibleRows.length} work{visibleRows.length === 1 ? "" : "s"} pending
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkFromHolder(group, "confirmed")}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  Confirm all
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkFromHolder(group, "declined")}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  Decline all
                </button>
              </div>
            </header>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleRows.map((row) => (
                <ConfirmationTile
                  key={row.claim.id}
                  row={row}
                  isPending={isPending}
                  onDecision={(d) => handleSingle(row.claim.id, d)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ConfirmationTile({
  row,
  isPending,
  onDecision,
}: {
  row: PendingConfirmation;
  isPending: boolean;
  onDecision: (d: "confirmed" | "declined" | "unknown") => void;
}) {
  const thumb = row.artwork.url;
  return (
    <li className="border border-stone-100 rounded-lg overflow-hidden flex flex-col">
      <div className="aspect-square bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt={row.artwork.title ?? "Artwork"} className="w-full h-full object-cover" />
      </div>
      <div className="p-3 space-y-1 flex-1">
        <p className="text-sm font-medium truncate">{row.artwork.title ?? "Untitled"}</p>
        <p className="text-xs text-muted-foreground">
          {row.artwork.medium ?? "Medium not stated"}
          {row.artwork.year ? ` · ${row.artwork.year}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-3 border-t border-stone-100 text-xs">
        <button
          type="button"
          onClick={() => onDecision("confirmed")}
          disabled={isPending}
          className="py-2 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-60"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => onDecision("declined")}
          disabled={isPending}
          className="py-2 text-red-700 hover:bg-red-50 transition-colors border-l border-stone-100 disabled:opacity-60"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => onDecision("unknown")}
          disabled={isPending}
          className="py-2 text-stone-600 hover:bg-stone-50 transition-colors border-l border-stone-100 disabled:opacity-60"
        >
          Not sure
        </button>
      </div>
    </li>
  );
}
