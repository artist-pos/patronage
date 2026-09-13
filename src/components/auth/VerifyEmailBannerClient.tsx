"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/actions/verification";

interface Props {
  /** Shown so a typo is visible at a glance — the commonest reason a
   *  confirmation never arrives. */
  email: string;
  /** Applications and the digest are artist concerns; everyone else is being
   *  asked so account recovery works. Naming the wrong reason reads as spam. */
  isArtist: boolean;
}

const MESSAGES: Record<string, string> = {
  sent: "Sent. Check your inbox, and your spam folder.",
  rate_limited: "One was sent in the last minute. Give it a moment.",
  already_verified: "Already confirmed. Refresh the page.",
  error: "Couldn't send just now. Try again shortly.",
};

export function VerifyEmailBannerClient({ email, isArtist }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      const { status } = await resendVerificationEmail();
      setStatus(MESSAGES[status] ?? MESSAGES.error);
    } catch {
      setStatus(MESSAGES.error);
    }
    setSending(false);
  }

  return (
    <div className="border-b border-border bg-stone-100 text-stone-700">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6">
        <p className="text-sm">
          {isArtist
            ? "Confirm your email to apply for opportunities and start your weekly digest."
            : "Confirm your email so you can recover your account."}
          {email && <span className="text-stone-500"> Sent to {email}.</span>}
        </p>
        {status ? (
          <span className="text-sm text-stone-500">{status}</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="text-sm font-medium text-foreground underline underline-offset-2 hover:opacity-70 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Resend"}
          </button>
        )}
      </div>
    </div>
  );
}
