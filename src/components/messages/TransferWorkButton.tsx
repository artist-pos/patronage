"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { initiateTransfer } from "@/app/messages/transfer-actions";
import type { Artwork } from "@/types/database";

interface Props {
  conversationId: string;
  artistAvailableWorks: Artwork[];
}

export function TransferWorkButton({ conversationId, artistAvailableWorks }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<Artwork | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (artistAvailableWorks.length === 0) return null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleConfirm() {
    if (!selectedWork || sending) return;
    setSending(true);
    const result = await initiateTransfer(selectedWork.id, conversationId);
    setSending(false);
    if (result.error) {
      showToast(`Error: ${result.error}`);
    } else {
      showToast("Transfer offer sent");
      setOpen(false);
      setSelectedWork(null);
    }
  }

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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-4 py-2 z-50">
          {toast}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-background border border-black w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Select Work to Transfer</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {artistAvailableWorks.map((work) => (
                <button
                  key={work.id}
                  onClick={() => setSelectedWork(work)}
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
                    {work.price && (
                      <p className={`text-xs ${selectedWork?.id === work.id ? "text-white/70" : "text-muted-foreground"}`}>
                        {work.price}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selectedWork || sending}
                onClick={handleConfirm}
              >
                {sending ? "Sending…" : "Send Transfer Offer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
