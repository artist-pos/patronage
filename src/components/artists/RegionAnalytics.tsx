"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { stashSignupContext } from "@/lib/signup-context.client";
import type { SignupContext } from "@/lib/signup-context";

/** Fires the regional page view once per mount. */
export function RegionPageView({ regionSlug }: { regionSlug: string }) {
  useEffect(() => {
    trackEvent("regional_page_view", { region: regionSlug });
  }, [regionSlug]);

  return null;
}

/**
 * Wraps a regional page link so the click is attributed.
 *
 * A plain <Link> would lose the region context, and adding an onClick to every
 * card inline would mean making the whole grid a client component.
 */
export function RegionTrackedLink({
  href,
  event,
  regionSlug,
  properties,
  signupContext,
  className,
  children,
}: {
  href: string;
  event: "regional_page_artist_click" | "regional_page_signup_click";
  regionSlug: string;
  properties?: Record<string, string>;
  /** Parked for /onboarding/role, so a signup from a regional CTA arrives
   *  already knowing its region and, for organisations, what it does. */
  signupContext?: SignupContext;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackEvent(event, { region: regionSlug, ...properties });
        if (signupContext) stashSignupContext(signupContext);
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Attributes clicks inside a card that already renders its own link. Wrapping
 * such a card in RegionTrackedLink nests one anchor in another, which gives
 * keyboard users two tab stops per card.
 */
export function RegionTrackedArea({
  event,
  regionSlug,
  properties,
  children,
}: {
  event: "regional_page_artist_click";
  regionSlug: string;
  properties?: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div onClickCapture={() => trackEvent(event, { region: regionSlug, ...properties })}>
      {children}
    </div>
  );
}
