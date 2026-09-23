"use client";

import { useState } from "react";
import { submitOpportunityTip } from "@/app/opportunities/tip-action";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import { useFormLoadedAt } from "@/lib/use-form-loaded-at";

const CAPTCHA_CONFIGURED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const FIELD =
  "w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-foreground focus:outline-none placeholder:text-[color:var(--fg-subtle)]";

const LABEL = "t-section-label block";

/**
 * Inline version of the community tip form. Lives on /list-an-opportunity as
 * the third listing route, so someone who only wants to point us at a listing
 * never has to work out which paid tier they belong in.
 */
export function OpportunityTipForm() {
  const [name, setName] = useState("");
  const [sourceLink, setSourceLink] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const loadedAt = useFormLoadedAt();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const honeypot = new FormData(e.currentTarget).get(HONEYPOT_FIELD) as string;
    const result = await submitOpportunityTip({
      name,
      sourceLink,
      email,
      turnstileToken,
      loadedAt,
      [HONEYPOT_FIELD]: honeypot,
    });
    setSubmitting(false);
    // Tokens are single-use, so a fresh challenge is needed after any attempt.
    setTurnstileToken("");
    (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="border border-border bg-[color:var(--success-bg)] p-6">
        <p className="text-sm font-medium">Thank you, we&rsquo;ve got it.</p>
        <p className="t-body-sm mt-1">
          We&rsquo;ll check the listing and add it to the directory if it&rsquo;s a fit for
          artists here. Usually within two business days.
        </p>
        <button
          type="button"
          onClick={() => {
            setName("");
            setSourceLink("");
            setEmail("");
            setSuccess(false);
          }}
          className="mt-4 text-xs underline underline-offset-2 text-[color:var(--fg-muted)] hover:text-foreground"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-xs text-[color:var(--urgent)]">{error}</p>}

      <div className="space-y-1.5">
        <label htmlFor="tip-name" className={LABEL}>
          Opportunity name
        </label>
        <input
          id="tip-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Creative NZ Project Development Fund"
          required
          className={FIELD}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tip-link" className={LABEL}>
          Source link
        </label>
        <input
          id="tip-link"
          value={sourceLink}
          onChange={(e) => setSourceLink(e.target.value)}
          type="url"
          placeholder="https://…"
          required
          className={FIELD}
        />
        <p className="t-caption">Where you saw it. We credit the board we took a listing from.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tip-email" className={LABEL}>
          Your email <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="tip-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Only so we can follow up if something's unclear"
          className={FIELD}
        />
      </div>

      <HoneypotField />
      <TurnstileWidget onVerify={setTurnstileToken} />

      <button
        type="submit"
        disabled={
          !name.trim() ||
          !sourceLink.trim() ||
          submitting ||
          (CAPTCHA_CONFIGURED && !turnstileToken)
        }
        className="btn btn-brand disabled:opacity-40"
      >
        {submitting ? "Sending…" : "Send the tip →"}
      </button>
    </form>
  );
}
