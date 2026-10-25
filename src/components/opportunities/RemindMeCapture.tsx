"use client";

import { useState } from "react";
import { remindMeAction } from "@/app/opportunities/reminder-actions";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { HoneypotField, HONEYPOT_FIELD } from "@/components/HoneypotField";
import { useFormLoadedAt } from "@/lib/use-form-loaded-at";
import { trackEvent } from "@/lib/analytics";

interface Props {
  opportunityId: string;
  /** Pre-formatted, e.g. "Friday 14 November". */
  deadlineLabel: string;
}

/**
 * One field, no account: "remind me before this closes". Shown to signed-out
 * visitors on open listings that have a deadline. Optionally adds the address to
 * the weekly digest, clearly stated beside the box.
 */
export function RemindMeCapture({ opportunityId, deadlineLabel }: Props) {
  const [email, setEmail] = useState("");
  const [alsoDigest, setAlsoDigest] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<null | { alreadyMember: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [started, setStarted] = useState(false);
  const loadedAt = useFormLoadedAt();

  function onFocus() {
    if (started) return;
    setStarted(true);
    trackEvent("remind_me_started", { opportunity_id: opportunityId });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const honeypot = new FormData(e.currentTarget).get(HONEYPOT_FIELD) as string;
    const result = await remindMeAction({
      opportunityId, email, alsoDigest, turnstileToken, loadedAt, [HONEYPOT_FIELD]: honeypot,
    });
    setSending(false);
    if (result.error) { setError(result.error); return; }
    trackEvent("remind_me_submitted", {
      opportunity_id: opportunityId,
      also_digest: String(alsoDigest),
      existing_member: String(!!result.alreadyMember),
    });
    setDone({ alreadyMember: !!result.alreadyMember });
  }

  if (done) {
    return (
      <div className="mt-5 max-w-[560px] border-l-2 border-foreground pl-4" role="status">
        <p className="text-[13.5px] font-medium">You&rsquo;re set.</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--fg-muted)]">
          {done.alreadyMember
            ? "You already have an account, so we've saved this to it and we'll email you before it closes."
            : `We'll email you a week before and again two days before it closes on ${deadlineLabel}. Check your inbox for a confirmation.`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 max-w-[560px] border border-border bg-card p-4">
      <p className="text-[13.5px] font-medium">Don&rsquo;t let this one slip past</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--fg-muted)]">
        It closes {deadlineLabel}. Pop your email in and we&rsquo;ll remind you a week before, and again two days
        before. No account needed.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`remind-${opportunityId}`} className="sr-only">Email address</label>
        <input
          id={`remind-${opportunityId}`}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onFocus={onFocus}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="h-10 shrink-0 bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {sending ? "Setting…" : "Remind me"}
        </button>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-[color:var(--fg-muted)]">
        <input
          type="checkbox"
          checked={alsoDigest}
          onChange={(e) => setAlsoDigest(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-black"
        />
        <span>
          Also send me <strong className="font-medium text-foreground">Patronage Weekly</strong>: the best new
          grants, residencies and open calls for NZ and Australian artists, once a week. Unsubscribe in one click.
        </span>
      </label>

      <HoneypotField />
      <TurnstileWidget onVerify={setTurnstileToken} />
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}
