"use client";

import Script from "next/script";
import { useEffect, useId } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile widget. Works both for object-based server action
 * calls (read the token from `onVerify`) and native `<form action>` server
 * actions (the widget auto-injects a `cf-turnstile-response` hidden input
 * into its nearest ancestor form) — no props needed to switch between them.
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't configured.
 */
export function TurnstileWidget({ onVerify }: { onVerify?: (token: string) => void }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const callbackName = `__turnstileCb_${rawId}`;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w[callbackName] = (token: string) => onVerify?.(token);
    return () => {
      delete w[callbackName];
    };
  }, [callbackName, onVerify]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={SITE_KEY} data-callback={callbackName} />
    </>
  );
}
