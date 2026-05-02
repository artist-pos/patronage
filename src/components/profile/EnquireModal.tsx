"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initializeInquiryThread } from "@/app/messages/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  artistId: string;
  workId?: string | null;
  workTitle: string | null;
  workImageUrl?: string | null;
  listingPrice?: string | null;
  listingCurrency?: string | null;
}

export function EnquireModal({
  open,
  onClose,
  artistId,
  workId,
  workTitle,
  workImageUrl,
  listingPrice,
  listingCurrency,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleEnquire() {
    setLoading(true);
    setError(null);
    try {
      const result = await initializeInquiryThread(
        artistId,
        "artwork_enquiry",
        workId ?? null
      );
      if ("error" in result) {
        if (result.error === "not_authenticated") {
          router.push("/auth/login");
          return;
        }
        setError("Couldn't open a conversation. Please try again.");
        return;
      }
      router.push(`/messages/${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  const displayPrice =
    listingPrice && listingPrice !== "POA" && !isNaN(Number(listingPrice))
      ? `${listingCurrency ?? "NZD"} ${Number(listingPrice).toLocaleString("en-NZ")}`
      : listingPrice === "POA"
      ? "Price on application"
      : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enquire about this work</DialogTitle>
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
              {displayPrice && (
                <p className="text-xs text-muted-foreground">{displayPrice}</p>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            This will open a private conversation with the artist. You can discuss details, negotiate a price, or ask any questions about the work.
          </p>

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
              type="button"
              onClick={handleEnquire}
              disabled={loading}
              className="text-sm px-4 py-2 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {loading ? "Opening…" : "Start conversation"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
