"use client";

import { useMemo, useState, useTransition } from "react";
import { initiateResale } from "@/app/dashboard/collection/[id]/transfer/actions";
import { calculateResaleFees, formatCents } from "@/lib/commerce-fee";

interface Props {
  membershipId: string;
  workTitle: string;
  artistName: string;
}

export function TransferForm({ membershipId, workTitle, artistName }: Props) {
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [salePriceText, setSalePriceText] = useState("");
  const [currency] = useState("NZD");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fees = useMemo(() => {
    const value = parseFloat(salePriceText);
    if (!Number.isFinite(value) || value <= 0) return null;
    return calculateResaleFees(Math.round(value * 100));
  }, [salePriceText]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const salePriceMajor = parseFloat(salePriceText);
    if (!Number.isFinite(salePriceMajor) || salePriceMajor <= 0) {
      setError("Enter a sale price greater than zero.");
      return;
    }
    if (!confirm(
      `Send ${buyerEmail} a Stripe checkout link for ${workTitle}? They'll be charged ${
        fees ? formatCents(fees.buyerPaidTotalCents) : "—"
      }.`,
    )) {
      return;
    }
    startTransition(async () => {
      const result = await initiateResale({
        membershipId,
        buyerEmail,
        buyerName,
        salePriceMajor,
        currency,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) {
        // Forward the seller to the hosted Stripe Checkout. They share the
        // resulting URL with the buyer (or initiate the payment themselves
        // when buyer is in person).
        window.location.href = result.checkoutUrl;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[640px] space-y-6">
      <fieldset className="space-y-4 border border-stone-200 rounded-xl p-6">
        <legend className="text-sm font-semibold uppercase tracking-widest text-stone-500 px-2">
          Buyer
        </legend>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Buyer email *</span>
          <input
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            required
            placeholder="buyer@example.com"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Buyer name (optional)</span>
          <input
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-4 border border-stone-200 rounded-xl p-6">
        <legend className="text-sm font-semibold uppercase tracking-widest text-stone-500 px-2">
          Sale price
        </legend>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            Sticker price (what you receive) — {currency}
          </span>
          <input
            type="text"
            value={salePriceText}
            onChange={(e) => setSalePriceText(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="3500"
            inputMode="decimal"
            className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
          />
        </label>

        {fees && (
          <dl className="text-sm border-t border-stone-100 pt-3 space-y-1.5">
            <Row label="Sticker (you receive)" value={formatCents(fees.salePriceCents)} />
            <Row
              label="Patronage commission (10%)"
              value={formatCents(fees.patronageCommissionCents)}
              muted
            />
            <Row
              label="Artist royalty (5%)"
              value={formatCents(fees.artistRoyaltyCents)}
              muted
            />
            <Row
              label="Processing fee (2.9% + 30c)"
              value={formatCents(fees.stripeFeeCents)}
              muted
            />
            <Row
              label="Buyer pays"
              value={formatCents(fees.buyerPaidTotalCents)}
              emphasis
            />
          </dl>
        )}

        <p className="text-xs text-muted-foreground">
          The 5% royalty is held for {artistName}. Once they&rsquo;re reachable
          and have payout details on file, Patronage transfers it to them.
        </p>
      </fieldset>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-foreground text-background text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? "Creating Stripe link…" : "Continue to Stripe"}
        </button>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-muted-foreground" : "text-foreground"}>
        {label}
      </dt>
      <dd className={emphasis ? "font-semibold" : muted ? "text-muted-foreground" : ""}>
        {value}
      </dd>
    </div>
  );
}
