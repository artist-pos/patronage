"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { initiateSupportCheckout } from "@/app/support/actions";
import { calculateFees, formatCents } from "@/lib/commerce-fee";
import type { SupportTier } from "@/types/database";

interface Props {
  tier: SupportTier;
  artistName: string;
  /** Pre-fills the email field; the action also reads the auth user, so
   *  this is mostly a UX nicety for logged-in supporters. */
  prefilledEmail?: string;
  onClose: () => void;
}

/**
 * Replaces the old waitlist intent modal. Captures email (if anonymous) +
 * forwards to Stripe Checkout. Recurring tiers go to subscription mode;
 * one-off tiers to payment mode — the action handles both.
 */
export function SupportCheckoutModal({ tier, artistName, prefilledEmail, onClose }: Props) {
  const [email, setEmail] = useState(prefilledEmail ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isRecurring = tier.tier_type === "recurring";
  const fees = calculateFees(
    isRecurring ? "support_recurring" : "support_one_off",
    Math.round(tier.price * 100),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await initiateSupportCheckout({
        tierId: tier.id,
        supporterEmail: email,
        supporterName: name,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-background border border-black">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black">
          <p className="text-sm font-semibold">Support {artistName}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{tier.title}</span> — NZD{" "}
              {tier.price.toLocaleString("en-NZ")}
              {isRecurring && <span className="text-muted-foreground"> / month</span>}
            </p>
            {tier.description && (
              <p className="text-xs text-muted-foreground">{tier.description}</p>
            )}
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Up-front price disclosure — NZ Commerce Commission requires the
              full mandatory price to be shown before checkout (no drip pricing). */}
          <div className="border border-border px-3 py-2.5 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tier.title}</span>
              <span className="font-mono">{formatCents(fees.subjectPriceCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Patronage commission (5%)</span>
              <span className="font-mono">{formatCents(fees.patronageRevenueCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Processing fee (2.9% + 30c)</span>
              <span className="font-mono">{formatCents(fees.stripeFeeCents)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <span className="font-medium">
                Total{isRecurring ? " / month" : ""}
              </span>
              <span className="font-mono font-medium">
                {formatCents(fees.buyerPaidTotalCents)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !email}
            className="w-full text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {isPending
              ? "Opening Stripe…"
              : isRecurring
                ? "Subscribe via Stripe"
                : "Pay via Stripe"}
          </button>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            The processing fee covers third-party card costs (Stripe) so {artistName} receives the full support amount.
          </p>
        </form>
      </div>
    </div>
  );
}
