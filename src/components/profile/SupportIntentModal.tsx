"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { registerSupportIntent } from "@/app/profile/support-tier-actions";
import type { SupportTier } from "@/types/database";

interface Props {
  tier: SupportTier;
  artistName: string;
  onClose: () => void;
}

export function SupportIntentModal({ tier, artistName, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await registerSupportIntent(tier.id, email);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      setDone(true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-background border border-black">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black">
          <p className="text-sm font-semibold">Support coming soon</p>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {done ? (
            <div className="space-y-2 text-center py-4">
              <p className="text-sm font-semibold">You&apos;re on the list.</p>
              <p className="text-xs text-muted-foreground">
                We&apos;ll let you know the moment {artistName}&apos;s Patronage gateway goes live.
              </p>
              <button
                onClick={onClose}
                className="mt-4 text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{artistName}</span> is setting up their
                  Patronage gateway.
                </p>
                <p className="text-sm text-muted-foreground">
                  Enter your email to be notified the moment{" "}
                  <span className="font-medium">
                    {tier.title} — NZD {tier.price.toLocaleString("en-NZ")}
                  </span>{" "}
                  goes live.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {submitting ? "Sending…" : "Notify Me"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
