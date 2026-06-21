import type { PricingBreakdown } from "@/lib/pricing";

function fmtN(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Canonical artist-facing price breakdown. Shows the full chain from what the
 * artist receives up to what the buyer pays, so every surface (new-work form,
 * editions editor, pricing calculator) reads identically.
 */
export function PricingBreakdownBox({
  breakdown,
  currency,
}: {
  breakdown: PricingBreakdown;
  currency: string;
}) {
  return (
    <div className="bg-muted/30 border border-border px-4 py-3 space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">You receive</span>
        <span className="font-medium text-emerald-700">{currency} {fmtN(breakdown.youReceive)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Patronage commission (10%)</span>
        <span>+ {currency} {fmtN(breakdown.commission)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Listed price</span>
        <span>{currency} {fmtN(breakdown.listedPrice)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Stripe processing (2.9% + 30¢)</span>
        <span>+ {currency} {fmtN(breakdown.stripeProcessing)}</span>
      </div>
      <div className="border-t border-border pt-2 flex justify-between">
        <span className="text-xs font-medium">Buyer pays</span>
        <span className="text-xs font-semibold">{currency} {fmtN(breakdown.buyerPays)}</span>
      </div>
    </div>
  );
}
