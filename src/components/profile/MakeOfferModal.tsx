"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendWorkOffer } from "@/app/messages/offer-actions";

interface Props {
  open: boolean;
  onClose: () => void;
  artistId: string;
  workId: string;
  workTitle: string | null;
  listingPriceCents?: number | null;
  listingCurrency: "NZD" | "AUD";
  workImageUrl?: string | null;
}

export function MakeOfferModal({
  open,
  onClose,
  artistId,
  workId,
  workTitle,
  listingPriceCents,
  listingCurrency,
  workImageUrl,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NZD" | "AUD">(listingCurrency);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setAmount("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(/,/g, ""));
    if (!parsed || parsed <= 0) {
      setError("Please enter a valid offer amount.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await sendWorkOffer(artistId, workId, parsed, currency);

    if (result.error) {
      setError(
        result.error === "not_authenticated"
          ? "You need to be signed in to make an offer."
          : result.error
      );
      setSubmitting(false);
      return;
    }

    router.push(`/messages/${result.conversationId}`);
  }

  const displayListingPrice = listingPriceCents
    ? `${listingCurrency} ${(listingPriceCents / 100).toLocaleString("en-NZ")}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Make an Offer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Work context — thumbnail card matching DM artwork card style */}
          <div className="flex border border-black overflow-hidden">
            {workImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workImageUrl}
                alt={workTitle ?? "Work"}
                className="w-16 h-16 object-cover shrink-0"
              />
            )}
            <div className="flex flex-col justify-center px-3 py-2 min-w-0">
              <p className="text-sm font-medium truncate">{workTitle ?? "Untitled"}</p>
              {displayListingPrice && (
                <p className="text-xs text-muted-foreground">{displayListingPrice}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Currency + Amount */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your offer</label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "NZD" | "AUD")}
                  className="border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground w-24"
                >
                  <option value="NZD">NZD</option>
                  <option value="AUD">AUD</option>
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0"
                  className="flex-1 border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your offer will be sent as a message. You can negotiate directly with the artist.
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="text-sm px-4 py-2 border border-border hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!amount.trim() || submitting}
                className="text-sm px-4 py-2 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Send Offer"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
