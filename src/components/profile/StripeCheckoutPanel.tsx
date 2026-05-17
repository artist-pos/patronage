"use client";

import { useState } from "react";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import { formatCents } from "@/lib/commerce-fee";
import type { ResolvedFees } from "@/lib/commerce-fee";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface PanelProps {
  clientSecret: string;
  fees: ResolvedFees;
  currency: string;
  workTitle: string | null;
  workImageUrl?: string | null;
  editionLabel?: string | null;
  artistName?: string | null;
  onBack: () => void;
  onSuccess: () => void;
}

function CheckoutForm({
  fees,
  currency,
  onBack,
  onSuccess,
}: Pick<PanelProps, "fees" | "currency" | "onBack" | "onSuccess">) {
  const result = useCheckoutElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (result.type !== "success") return;
    setProcessing(true);
    setError(null);

    const confirmResult = await result.checkout.confirm();

    if (confirmResult.type === "error") {
      setError(confirmResult.error.message ?? "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    onSuccess();
  }

  if (result.type === "error") {
    return <p className="text-sm text-destructive">Failed to load payment form: {result.error.message}</p>;
  }

  const loading = result.type === "loading";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: "accordion",
        }}
      />

      {/* Fee summary */}
      <div className="border border-border px-4 py-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Sale price</span>
          <span className="font-mono">{formatCents(fees.subjectPriceCents, currency)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Processing fee</span>
          <span className="font-mono">{formatCents(fees.stripeFeeCents, currency)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 mt-1 font-semibold text-foreground">
          <span>Total</span>
          <span className="font-mono">{formatCents(fees.buyerPaidTotalCents, currency)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 items-center">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="text-sm px-4 py-2.5 border border-border hover:bg-muted/40 transition-colors disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="submit"
          disabled={processing || loading}
          className="flex-1 text-sm py-2.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {processing ? "Processing…" : `Pay ${formatCents(fees.buyerPaidTotalCents, currency)}`}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Secured by Stripe · You&apos;ll receive a verified provenance certificate after purchase.
      </p>
    </form>
  );
}

export function StripeCheckoutPanel({
  clientSecret,
  fees,
  currency,
  workTitle,
  workImageUrl,
  editionLabel,
  artistName,
  onBack,
  onSuccess,
}: PanelProps) {
  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: {
          fonts: [
            { cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" },
          ],
          appearance: {
            theme: "stripe",
            variables: {
              fontFamily: "'Geist', system-ui, sans-serif",
              borderRadius: "0px",
              colorBackground: "#FAFAF9",
            },
          },
        },
      }}
    >
      <div className="space-y-4">
        {/* Order summary row */}
        <div className="flex items-center gap-3 p-3 border border-border">
          {workImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workImageUrl}
              alt={workTitle ?? "Artwork"}
              className="w-14 h-14 object-cover shrink-0 bg-muted"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{workTitle ?? "Untitled"}</p>
            {editionLabel && (
              <p className="text-xs text-muted-foreground">{editionLabel}</p>
            )}
            {artistName && (
              <p className="text-xs text-muted-foreground">{artistName}</p>
            )}
          </div>
        </div>

        <CheckoutForm
          fees={fees}
          currency={currency}
          onBack={onBack}
          onSuccess={onSuccess}
        />
      </div>
    </CheckoutElementsProvider>
  );
}
