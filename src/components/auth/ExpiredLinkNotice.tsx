"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Supabase redirects an expired/invalid email link to /auth/login with the
 * error details in the URL *hash* (e.g. #error=access_denied&error_code=
 * otp_expired). The hash never reaches the server, so this client component
 * reads it and surfaces a recovery path instead of leaving the user stuck.
 */
export function ExpiredLinkNotice() {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (
      hash.includes("otp_expired") ||
      hash.includes("access_denied") ||
      hash.includes("error_code=")
    ) {
      setExpired(true);
      // Strip the hash so a refresh doesn't keep re-triggering the notice.
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  if (!expired) return null;

  return (
    <div className="text-xs border border-destructive/40 bg-destructive/5 px-3 py-2.5 space-y-1">
      <p className="text-destructive">
        Your confirmation link was invalid or had expired.
      </p>
      <Link href="/auth/confirm?status=expired" className="underline underline-offset-2">
        Resend confirmation email →
      </Link>
    </div>
  );
}
