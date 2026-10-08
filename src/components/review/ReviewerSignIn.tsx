"use client";

import { useState } from "react";
import { requestReviewerLink } from "@/app/partner/opportunities/[id]/collaborators/actions";

interface Props {
  opportunityId: string;
  title: string;
}

/** Shown when someone opens a review link while signed out, or after it expires. */
export function ReviewerSignIn({ opportunityId, title }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    await requestReviewerLink(opportunityId, email);
    setSending(false);
    setSent(true);
  }

  return (
    <div className="ams-comfort mx-auto flex min-h-[calc(100vh-10rem)] max-w-md items-center px-6">
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-500">Review team</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-stone-500">
            Enter the email address you were invited on and we&apos;ll send you a link. There&apos;s no password to remember.
          </p>
        </div>
        {sent ? (
          <div role="status" className="border border-black/10 bg-stone-50 p-4 text-sm">
            If that address is on the review team, a sign-in link is on its way. It can take a minute to arrive.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label htmlFor="reviewer-email" className="block text-sm font-medium uppercase tracking-widest text-stone-500">
              Email
            </label>
            <input
              id="reviewer-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-black/30 px-3 py-2.5 text-base focus:border-black focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-black/80 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
