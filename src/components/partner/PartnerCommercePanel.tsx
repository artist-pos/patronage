"use client";

import { useState, useTransition } from "react";
import { initiatePipelineActivation } from "@/app/partner/opportunities/[id]/activate/actions";
import { initiateFeaturedListing } from "@/app/partner/opportunities/[id]/feature/actions";
import {
  FEATURED_LISTING_PLANS,
  PIPELINE_ACTIVATION_PRICE_CENTS,
  PRICING_CURRENCY,
  grossUpForStripe,
} from "@/lib/commerce-pricing";
import { formatCents } from "@/lib/commerce-fee";

interface Props {
  opportunityId: string;
  pipelinePaidAt: string | null;
  featuredUntil: string | null;
}

/**
 * Two Patronage-direct CTAs for partners on the edit page:
 *   - Activate pipeline (one-shot per opportunity)
 *   - Boost as featured (stacks; extends featured_until)
 */
export function PartnerCommercePanel({
  opportunityId,
  pipelinePaidAt,
  featuredUntil,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePipeline() {
    setError(null);
    startTransition(async () => {
      const result = await initiatePipelineActivation(opportunityId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    });
  }

  function handleFeature(days: number) {
    setError(null);
    startTransition(async () => {
      const result = await initiateFeaturedListing(opportunityId, days);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    });
  }

  // 1-frame staleness from Date.now() is harmless for an "is this still
  // active" copy badge — refreshes on the next navigation.
  // eslint-disable-next-line react-hooks/purity
  const featuredActive = featuredUntil != null && new Date(featuredUntil).getTime() > Date.now();

  return (
    <section className="border border-stone-200 rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500">
          Pipeline & promotion
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Optional partner add-ons. External-link listings remain free.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-stone-100 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">Pipeline activation</p>
          <p className="text-xs text-muted-foreground">
            Use Patronage&rsquo;s submission flow instead of an external
            application link.
          </p>
          {pipelinePaidAt ? (
            <p className="text-xs text-emerald-700">
              Active since {pipelinePaidAt.slice(0, 10)}.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePipeline}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-60"
              >
                Activate — {formatCents(
                  grossUpForStripe(PIPELINE_ACTIVATION_PRICE_CENTS).buyerTotalCents,
                  PRICING_CURRENCY,
                )}
              </button>
              <p className="text-[10px] text-muted-foreground">
                Includes a {formatCents(
                  grossUpForStripe(PIPELINE_ACTIVATION_PRICE_CENTS).stripeFeeCents,
                  PRICING_CURRENCY,
                )} processing fee (2.9% + 30c).
              </p>
            </>
          )}
        </div>

        <div className="border border-stone-100 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">Featured listing</p>
          <p className="text-xs text-muted-foreground">
            Promote this listing in featured slots across Patronage. Stacks
            with prior purchases.
          </p>
          {featuredActive && featuredUntil && (
            <p className="text-xs text-emerald-700">
              Featured until {featuredUntil.slice(0, 10)}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {FEATURED_LISTING_PLANS.map((plan) => {
              const { buyerTotalCents } = grossUpForStripe(plan.amountCents);
              return (
                <button
                  key={plan.days}
                  type="button"
                  onClick={() => handleFeature(plan.days)}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-60"
                >
                  {plan.label} — {formatCents(buyerTotalCents, PRICING_CURRENCY)}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Includes a 2.9% + 30c card processing fee.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}
    </section>
  );
}
