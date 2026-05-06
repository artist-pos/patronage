"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { initiateTransfer } from "@/app/messages/transfer-actions";
import type { Artwork } from "@/types/database";

interface Props {
  conversationId: string;
  artistAvailableWorks: Artwork[];
}

type Step = "select" | "price";

export function TransferWorkButton({ conversationId, artistAvailableWorks }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [selectedWork, setSelectedWork] = useState<Artwork | null>(null);
  const [priceText, setPriceText] = useState("");
  const [currency, setCurrency] = useState<"NZD" | "AUD">("NZD");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (artistAvailableWorks.length === 0) return null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleClose() {
    setOpen(false);
    setStep("select");
    setSelectedWork(null);
    setPriceText("");
  }

  function handleWorkSelect(work: Artwork) {
    setSelectedWork(work);
    // Pre-fill price from the work's listed price if present
    if (work.price_cents && !work.is_poa) {
      setPriceText(String(work.price_cents / 100));
      setCurrency((work.price_currency as "NZD" | "AUD") ?? "NZD");
    } else {
      setPriceText("");
    }
  }

  async function handleConfirm() {
    if (!selectedWork || sending) return;
    setSending(true);

    const priceMajor = priceText ? parseFloat(priceText) : 0;
    const result = await initiateTransfer(
      selectedWork.id,
      conversationId,
      priceMajor > 0 ? priceMajor : undefined,
      priceMajor > 0 ? currency : undefined,
    );

    setSending(false);

    if (result.error) {
      showToast(`Error: ${result.error}`);
      return;
    }

    if (result.checkoutUrl) {
      // Paid transfer — send the artist to Stripe to complete the sale.
      // (In practice the patron pays, but the artist initiates and is redirected
      // to a confirmation page; the checkout URL is shared via the message card.)
      handleClose();
      showToast("Transfer offer sent — patron will receive a payment link.");
    } else {
      showToast("Gift transfer offer sent");
      handleClose();
    }
  }

  const priceMajor = priceText ? parseFloat(priceText) : 0;
  const commission = priceMajor * 0.10;
  const takeHome = priceMajor - commission;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-xs border-black"
        onClick={() => setOpen(true)}
      >
        Transfer Artwork →
      </Button>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-4 py-2 z-50">
          {toast}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="bg-background border border-black w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest">
                {step === "select" ? "Select Work to Transfer" : "Set Sale Price"}
              </h2>
              <button onClick={handleClose} className="text-xs text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            {step === "select" && (
              <>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {artistAvailableWorks.map((work) => (
                    <button
                      key={work.id}
                      onClick={() => handleWorkSelect(work)}
                      className={`w-full flex items-center gap-3 p-2 border text-left transition-colors ${
                        selectedWork?.id === work.id
                          ? "border-black bg-black text-white"
                          : "border-border hover:border-black"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={work.url}
                        alt={work.caption ?? "Work"}
                        className="w-14 h-14 object-cover flex-none"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                        {work.is_poa ? (
                          <p className={`text-xs ${selectedWork?.id === work.id ? "text-white/70" : "text-muted-foreground"}`}>
                            Price on application
                          </p>
                        ) : work.price_cents ? (
                          <p className={`text-xs ${selectedWork?.id === work.id ? "text-white/70" : "text-muted-foreground"}`}>
                            {work.price_currency} {(work.price_cents / 100).toLocaleString("en-NZ")}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
                  <Button size="sm" disabled={!selectedWork} onClick={() => setStep("price")}>
                    Next →
                  </Button>
                </div>
              </>
            )}

            {step === "price" && selectedWork && (
              <>
                <div className="flex items-center gap-3 p-2 border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedWork.url} alt={selectedWork.caption ?? "Work"} className="w-12 h-12 object-cover flex-none" />
                  <p className="text-sm font-medium truncate">{selectedWork.caption ?? "Untitled"}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Set a sale price, or leave blank to transfer as a gift.
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Price (leave blank for gift)</label>
                      <input
                        type="text"
                        value={priceText}
                        onChange={(e) => setPriceText(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as "NZD" | "AUD")}
                        className="border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                      >
                        <option value="NZD">NZD</option>
                        <option value="AUD">AUD</option>
                      </select>
                    </div>
                  </div>

                  {priceMajor > 0 && (
                    <div className="border border-border px-3 py-2 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sale price</span>
                        <span className="font-mono">{currency} {priceMajor.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Patronage commission (10%)</span>
                        <span className="font-mono">−{currency} {commission.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1 mt-1">
                        <span className="font-medium">Your take-home</span>
                        <span className="font-mono font-medium">{currency} {takeHome.toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground pt-0.5">
                        Card processing fee (2.9% + 30c) added to patron&rsquo;s total at checkout.
                      </p>
                    </div>
                  )}

                  {priceMajor === 0 && priceText === "" && (
                    <p className="text-[11px] text-muted-foreground">
                      This will be recorded as a gift on the provenance ledger.
                    </p>
                  )}
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setStep("select")}>← Back</Button>
                  <Button size="sm" disabled={sending} onClick={handleConfirm}>
                    {sending
                      ? "Sending…"
                      : priceMajor > 0
                      ? `Send Offer — ${currency} ${priceMajor.toFixed(2)}`
                      : "Send Gift Transfer"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
