"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initiatePrimarySale } from "@/app/sale/actions";
import { calculateFees, formatCents } from "@/lib/commerce-fee";

interface Props {
  artworkId: string;
  workTitle: string | null;
  priceCents: number;
  currency: string;
  workImageUrl?: string | null;
  year?: number | null;
  medium?: string | null;
  dimensions?: string | null;
  edition?: string | null;
  artistName?: string | null;
}

export function BuyWorkButton({
  artworkId,
  workTitle,
  priceCents,
  currency,
  workImageUrl,
  year,
  medium,
  dimensions,
  edition,
  artistName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fees = useMemo(
    () => calculateFees("primary_sale", priceCents),
    [priceCents],
  );

  function handleClose() {
    setError(null);
    setOpen(false);
  }

  function handleBuy() {
    setError(null);
    startTransition(async () => {
      const result = await initiatePrimarySale({
        artworkId,
        buyerEmail: email,
        buyerName: name,
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

  const metaLines = [
    artistName && { label: "Artist", value: artistName },
    year && { label: "Year", value: String(year) },
    medium && { label: "Medium", value: medium },
    dimensions && { label: "Dimensions", value: dimensions },
    edition && { label: "Edition", value: edition },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-black text-white text-xs py-1.5 px-3 hover:opacity-80 transition-opacity"
      >
        Buy
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        {/* sm:max-w-4xl overrides the sm:max-w-lg baked into DialogContent */}
        <DialogContent className="sm:max-w-4xl w-full p-0 gap-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row" style={{ height: "min(82vh, 680px)" }}>
            {/* Left — artwork image fills the panel at natural aspect ratio */}
            {workImageUrl && (
              <div className="sm:w-[45%] shrink-0 bg-stone-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={workImageUrl}
                  alt={workTitle ?? "Artwork"}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Right — details + form, scrollable if content overflows */}
            <div className="flex-1 flex flex-col p-8 gap-5 min-w-0 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl leading-snug pr-6">
                  {workTitle ?? "Untitled"}
                </DialogTitle>
              </DialogHeader>

              {/* Artwork metadata */}
              {metaLines.length > 0 && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {metaLines.map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-sm">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Buyer details */}
              <div className="space-y-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="w-full border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                />
              </div>

              {/* Fee breakdown */}
              {fees && (
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
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3 justify-end mt-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="text-sm px-5 py-2.5 border border-border hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBuy}
                  disabled={isPending || !email}
                  className="text-sm px-5 py-2.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {isPending ? "Opening Stripe…" : `Pay ${formatCents(fees.buyerPaidTotalCents, currency)} →`}
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                You&apos;ll receive a verified provenance certificate after purchase.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
