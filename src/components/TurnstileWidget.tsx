"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface Props {
  onVerify?: (token: string) => void;
  /** The challenge couldn't load or run — e.g. a content blocker stopped Cloudflare's script. */
  onError?: () => void;
  /** The token timed out unused, or the challenge itself timed out. It must be re-solved. */
  onExpire?: () => void;
  /** Bump to discard the current token and re-run the challenge. Tokens are single-use,
   *  so a form that rejects a submission must reset before the user retries. */
  resetSignal?: number;
}

/**
 * Cloudflare Turnstile widget. Works both for object-based server action
 * calls (read the token from `onVerify`) and native `<form action>` server
 * actions (the widget auto-injects a `cf-turnstile-response` hidden input
 * into its nearest ancestor form) — no props needed to switch between them.
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't configured.
 */
export function TurnstileWidget({ onVerify, onError, onExpire, resetSignal }: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const callbackName = `__turnstileCb_${rawId}`;
  const errorName = `__turnstileErr_${rawId}`;
  const expiredName = `__turnstileExp_${rawId}`;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w[callbackName] = (token: string) => onVerify?.(token);
    w[errorName] = () => {
      onError?.();
      return true; // tell Turnstile we handled it, so it doesn't also log a console error
    };
    w[expiredName] = () => onExpire?.();
    return () => {
      delete w[callbackName];
      delete w[errorName];
      delete w[expiredName];
    };
  }, [callbackName, errorName, expiredName, onVerify, onError, onExpire]);

  // Skip the first render — a reset before the widget has mounted is a no-op at best
  const lastReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal === lastReset.current) return;
    lastReset.current = resetSignal;
    const turnstile = (window as unknown as { turnstile?: { reset: (el: HTMLElement) => void } }).turnstile;
    if (turnstile && containerRef.current) turnstile.reset(containerRef.current);
  }, [resetSignal]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        strategy="afterInteractive"
        onError={() => onError?.()}
      />
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-sitekey={SITE_KEY}
        data-callback={callbackName}
        data-error-callback={errorName}
        data-expired-callback={expiredName}
        data-timeout-callback={expiredName}
      />
    </>
  );
}
