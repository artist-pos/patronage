"use client";

import { useRef, useState, useTransition } from "react";
import { appealDecline } from "@/app/dashboard/collection/appeal-actions";
import type { HolderAttributionClaim } from "@/types/database";

interface Props {
  claim: HolderAttributionClaim;
}

/**
 * Renders the holder-facing banner for an attribution claim. Each status has
 * a distinct visual + CTA: pending shows progress, confirmed celebrates,
 * declined exposes the appeal flow, resolved/unknown sit quietly.
 */
export function ClaimStatusBanner({ claim }: Props) {
  if (claim.status === "pending") {
    return (
      <Banner tone="amber" title="Awaiting artist confirmation">
        We&rsquo;ve let the artist know you&rsquo;ve registered this work. The
        public trust tier stays at &ldquo;Recorded by holder&rdquo; until they
        confirm.
      </Banner>
    );
  }

  if (claim.status === "confirmed") {
    return (
      <Banner tone="emerald" title="Confirmed by the artist">
        The artist has confirmed your record. Trust tier promoted to
        &ldquo;Confirmed by artist&rdquo;.
      </Banner>
    );
  }

  if (claim.status === "resolved_by_patronage") {
    return (
      <Banner tone="blue" title="Resolved by Patronage">
        Patronage has adjudicated a dispute on this record.
        {claim.decline_reason ? ` Note: ${claim.decline_reason}` : ""}
      </Banner>
    );
  }

  if (claim.status === "declined") {
    return <DeclinedSection claim={claim} />;
  }

  return null;
}

function DeclinedSection({ claim }: { claim: HolderAttributionClaim }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!claim.decline_appealed_at);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <Banner tone="blue" title="Appeal submitted">
        Patronage will review your appeal and resolve the dispute. You&rsquo;ll
        get an email when there&rsquo;s an update.
      </Banner>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    const form = new FormData();
    form.set("claimId", claim.id);
    form.set("message", message);
    if (file) form.set("evidence", file);
    startTransition(async () => {
      const result = await appealDecline(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
      setShowForm(false);
    });
  }

  return (
    <Banner tone="red" title="The artist declined this record">
      <p>
        Your record has been removed from public surfaces but stays in your
        private vault. If you believe the decline is wrong (e.g.
        misattribution, estate mistake), you can appeal — Patronage will
        review.
      </p>
      {claim.decline_reason && (
        <p className="mt-2 italic">Artist&rsquo;s note: {claim.decline_reason}</p>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 text-xs underline text-stone-700 hover:text-stone-900"
        >
          Appeal this decline →
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              Your appeal (what should Patronage consider?)
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              required
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              Evidence (optional) — invoice, photo, gallery email, etc.
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="text-xs"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-60"
            >
              {isPending ? "Submitting…" : "Submit appeal"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Banner>
  );
}

const TONE_STYLES: Record<"amber" | "emerald" | "blue" | "red", string> = {
  amber:   "bg-amber-50 border-amber-200 text-amber-900",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
  blue:    "bg-blue-50 border-blue-200 text-blue-900",
  red:     "bg-red-50 border-red-200 text-red-900",
};

function Banner({
  tone,
  title,
  children,
}: {
  tone: keyof typeof TONE_STYLES;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${TONE_STYLES[tone]}`}>
      <p className="font-medium mb-1">{title}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
