"use client";

import { useState } from "react";
import { submitActivationEnquiry } from "@/app/partners/actions";

const INTERESTS = ["Activations", "Art strategy", "Pipeline", "Listing", "Other"] as const;

const LABEL = "mb-[3px] block font-mono text-[9px] uppercase text-[color:var(--fg-subtle)]";
const INPUT =
  "w-full border border-border bg-card px-2.5 py-2 text-[12.5px] text-foreground outline-none placeholder:text-[color:var(--fg-subtle)] focus:border-foreground";

export function PartnerContactForm() {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState<string>(INTERESTS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const result = await submitActivationEnquiry({
      name,
      organisation: org,
      email,
      interests: [interest],
      message,
    });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="border-l-[3px] border-brand bg-card px-[18px] py-4">
        <p className="text-sm font-semibold">Thanks — we&rsquo;ve got it.</p>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-[color:var(--fg-muted)]">
          We&rsquo;ll reply to {email} within two business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[9px]">
      <div>
        <label htmlFor="pc-name" className={LABEL}>Name</label>
        <input
          id="pc-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="pc-org" className={LABEL}>Organisation</label>
        <input
          id="pc-org"
          type="text"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="pc-email" className={LABEL}>Email</label>
        <input
          id="pc-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="pc-interest" className={LABEL}>Interested in</label>
        <select
          id="pc-interest"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          className={`${INPUT} font-mono`}
        >
          {INTERESTS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pc-message" className={LABEL}>Tell us more</label>
        <textarea
          id="pc-message"
          required
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${INPUT} resize-y`}
        />
      </div>
      {error && <p className="text-[12px] text-[color:var(--urgent)]">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="mt-1.5 bg-foreground p-[11px] text-[13px] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
