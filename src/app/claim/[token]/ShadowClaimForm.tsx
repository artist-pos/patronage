"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { claimShadowAccount } from "./actions";

interface Props {
  token: string;
  defaultEmail: string;
  label: string;
}

/**
 * Claim by choosing an email and password. The email is prefilled with the one
 * the link was sent to but is free to change, so a link that reached the wrong
 * person can be forwarded and claimed with the right address.
 */
export function ShadowClaimForm({ token, defaultEmail, label }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await claimShadowAccount({ token, email, password });
      if (res.error || !res.redirectTo) {
        setError(res.error ?? "Something went wrong. Try again.");
        return;
      }
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        // Claimed, but the session did not start. Sending them to sign in is
        // the recoverable path, and their password already works.
        window.location.href = "/auth/login";
        return;
      }
      window.location.href = res.redirectTo;
    });
  }

  const inputCls =
    "w-full border border-black bg-background px-3 py-2 text-base focus-visible:outline-none sm:text-sm";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="claim-email" className="text-sm font-medium">
          Your email
        </label>
        <input
          id="claim-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <p className="text-xs text-muted-foreground">
          This becomes the login for {label}. Use the address you want to sign in with.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="claim-password" className="text-sm font-medium">
          Choose a password
        </label>
        <input
          id="claim-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={inputCls}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black/80 disabled:opacity-50"
      >
        {isPending ? "Claiming…" : "Claim profile →"}
      </button>
    </form>
  );
}
