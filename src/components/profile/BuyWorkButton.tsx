"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import dynamic from "next/dynamic";
import { createPrimaryEmbeddedCheckout } from "@/app/sale/actions";
import { calculateFees, formatCents } from "@/lib/commerce-fee";
import type { ResolvedFees } from "@/lib/commerce-fee";
import type { EditionOption } from "@/components/feed/WorksJustifiedGrid";

const StripeCheckoutPanel = dynamic(
  () => import("./StripeCheckoutPanel").then((m) => m.StripeCheckoutPanel),
  { ssr: false }
);

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
  editions?: EditionOption[];
  description?: string | null;
  artistName?: string | null;
}

type Step = "artwork" | "checkout" | "success";

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
  editions = [],
  description,
  artistName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("artwork");
  const [email, setEmail] = useState("");
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(
    editions.find((e) => e.listed)?.id ?? null
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fees, setFees] = useState<ResolvedFees | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedEdition = editions.find((e) => e.id === selectedEditionId) ?? null;
  const effectivePriceCents = selectedEdition?.price_cents ?? priceCents;
  const effectiveCurrency = selectedEdition?.currency ?? currency;
  const effectiveLabel = selectedEdition?.label ?? edition ?? null;

  const previewFees = useMemo(
    () => (effectivePriceCents > 0 ? calculateFees("primary_sale", effectivePriceCents) : null),
    [effectivePriceCents]
  );

  function handleOpen() {
    setStep("artwork");
    setError(null);
    setClientSecret(null);
    setFees(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleProceedToCheckout() {
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createPrimaryEmbeddedCheckout({
        artworkId,
        editionId: selectedEditionId,
        buyerEmail: email,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.clientSecret && result.fees) {
        setClientSecret(result.clientSecret);
        setFees(result.fees);
        setStep("checkout");
      }
    });
  }

  const metaLine = [
    year && String(year),
    medium,
    dimensions,
  ].filter(Boolean).join(" · ");

  const listedEditions = editions.filter((e) => e.listed);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full bg-black text-white text-xs py-1.5 px-3 hover:opacity-80 transition-opacity"
      >
        Buy
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-4xl w-full p-0 gap-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row" style={{ height: "min(82vh, 680px)" }}>
            {/* Left — artwork image */}
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

            {/* Right — content panel, scrollable */}
            <div className="flex-1 flex flex-col p-8 gap-5 min-w-0 overflow-y-auto">

              {step === "success" ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="text-4xl">✓</div>
                  <h2 className="text-xl font-semibold">Purchase complete</h2>
                  <p className="text-sm text-muted-foreground">
                    Check your email for a receipt and provenance certificate link.
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-sm px-5 py-2.5 border border-border hover:bg-muted/40 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : step === "checkout" && clientSecret && fees ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-lg pr-6">Complete purchase</DialogTitle>
                  </DialogHeader>
                  <StripeCheckoutPanel
                    clientSecret={clientSecret}
                    fees={fees}
                    currency={effectiveCurrency}
                    workTitle={workTitle}
                    workImageUrl={workImageUrl}
                    editionLabel={effectiveLabel}
                    artistName={artistName}
                    onBack={() => setStep("artwork")}
                    onSuccess={() => setStep("success")}
                  />
                </>
              ) : (
                <>
                  {/* Step 1 — Artwork context */}
                  <DialogHeader>
                    <DialogTitle className="text-xl leading-snug pr-6">
                      {workTitle ?? "Untitled"}
                    </DialogTitle>
                  </DialogHeader>

                  {/* Artist + meta */}
                  <div className="space-y-1">
                    {artistName && (
                      <p className="text-sm text-muted-foreground">{artistName}</p>
                    )}
                    {metaLine && (
                      <p className="text-xs text-muted-foreground">{metaLine}</p>
                    )}
                  </div>

                  {description && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                      {description}
                    </p>
                  )}

                  {/* Edition selector */}
                  {listedEditions.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Edition
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {listedEditions.map((ed) => (
                          <button
                            key={ed.id}
                            type="button"
                            onClick={() => setSelectedEditionId(ed.id)}
                            className={`text-xs px-3 py-1.5 border transition-colors ${
                              selectedEditionId === ed.id
                                ? "border-black bg-black text-white"
                                : "border-border hover:border-stone-400"
                            }`}
                          >
                            {ed.label || ed.type || "Edition"}
                            {!ed.poa && ed.price_cents != null && (
                              <span className="ml-1.5 opacity-70">
                                {formatCents(ed.price_cents, ed.currency)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price row */}
                  {previewFees && (
                    <div className="border border-border px-4 py-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Sale price</span>
                        <span className="font-mono">{formatCents(previewFees.subjectPriceCents, effectiveCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Processing fee</span>
                        <span className="font-mono">{formatCents(previewFees.stripeFeeCents, effectiveCurrency)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 mt-1 font-semibold text-foreground">
                        <span>Total</span>
                        <span className="font-mono">{formatCents(previewFees.buyerPaidTotalCents, effectiveCurrency)}</span>
                      </div>
                    </div>
                  )}

                  {/* Email input */}
                  <div className="space-y-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email address"
                      required
                      className="w-full border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                    />
                  </div>

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
                      onClick={handleProceedToCheckout}
                      disabled={isPending || !email.trim()}
                      className="text-sm px-5 py-2.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
                    >
                      {isPending ? "Loading…" : "Buy this edition →"}
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    You&apos;ll receive a verified provenance certificate after purchase.
                  </p>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
