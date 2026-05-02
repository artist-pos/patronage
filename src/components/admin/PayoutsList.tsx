"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  markRoyaltyPaid,
  markSellerPayoutPaid,
  refundExpiredHold,
} from "@/app/admin/payouts/actions";
import { formatCents } from "@/lib/commerce-fee";
import type {
  RoyaltyHoldRow,
  SellerPayoutRow,
} from "@/app/admin/payouts/page";

interface Props {
  sellerPayouts: SellerPayoutRow[];
  royaltyHolds: RoyaltyHoldRow[];
}

export function PayoutsList({ sellerPayouts, royaltyHolds }: Props) {
  return (
    <div className="space-y-12">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          Sellers — owed
        </h2>
        {sellerPayouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending seller payouts.</p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-100 rounded-lg">
            {sellerPayouts.map((row) => (
              <SellerRow key={`${row.kind}:${row.transactionId}`} row={row} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          Artist royalties — held
        </h2>
        {royaltyHolds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No held royalties.</p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-100 rounded-lg">
            {royaltyHolds.map((row) => (
              <RoyaltyRow key={row.hold.id} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SellerRow({ row }: { row: SellerPayoutRow }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markSellerPayoutPaid(row.kind, row.transactionId, note);
      if (result.error) setError(result.error);
    });
  }

  const sellerLabel = row.seller.full_name ?? row.seller.username;
  const kindLabel = row.kind === "resale" ? "Resale" : "Primary sale";

  return (
    <li className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
      <div>
        <p className="text-sm font-medium">
          <span className="text-[10px] uppercase tracking-widest text-stone-400 mr-2">
            {kindLabel}
          </span>
          {sellerLabel} — <span className="font-normal">{row.workTitle}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Owed {formatCents(row.amountCents, row.currency)} ·
          paid {row.paidAt?.slice(0, 10) ?? "—"}
        </p>
        <Link
          href={`/${row.seller.username}`}
          className="text-xs underline text-stone-700"
        >
          @{row.seller.username}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reference / method"
          className="border border-stone-200 rounded px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={handleMarkPaid}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
        >
          Mark paid
        </button>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
      </div>
    </li>
  );
}

function RoyaltyRow({ row }: { row: RoyaltyHoldRow }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markRoyaltyPaid(row.hold.id, note);
      if (result.error) setError(result.error);
    });
  }

  function handleRefund() {
    if (!confirm(
      `Refund the held ${formatCents(row.hold.amount_cents, row.hold.currency)} to the seller? Use only after the 90-day expiry.`,
    )) return;
    setError(null);
    startTransition(async () => {
      const result = await refundExpiredHold(row.hold.id, note);
      if (result.error) setError(result.error);
    });
  }

  return (
    <li className={`p-4 space-y-2 ${row.expired ? "bg-amber-50" : ""}`}>
      <div>
        <p className="text-sm font-medium">
          {row.artistLabel} —{" "}
          <span className="font-normal">{row.workTitle}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Held {formatCents(row.hold.amount_cents, row.hold.currency)} · expires {row.hold.expires_at.slice(0, 10)}
          {row.expired && " · EXPIRED"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reference / method"
          className="border border-stone-200 rounded px-2 py-1 text-xs flex-1 min-w-[180px]"
        />
        <button
          type="button"
          onClick={handleMarkPaid}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
        >
          Pay artist
        </button>
        <button
          type="button"
          onClick={handleRefund}
          disabled={isPending || !row.expired}
          title={row.expired ? "Refund the seller (90-day expiry hit)" : "Only available after expiry"}
          className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          Refund seller
        </button>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
      </div>
    </li>
  );
}
