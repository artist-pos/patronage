"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

interface Props {
  href: string;
  /** PostHog / analytics_events event name, e.g. "opportunities_tab_click". */
  event: string;
  /** String-only properties, the shape trackEvent stores. */
  props?: Record<string, string>;
  className?: string;
  "aria-current"?: "page" | undefined;
  children: React.ReactNode;
}

/**
 * An internal Link that records a click before navigating. For server-rendered
 * pages that want a button-level event without becoming client components
 * themselves. trackEvent never throws or blocks, so navigation is unaffected.
 */
export function TrackedNavLink({ href, event, props = {}, className, children, ...rest }: Props) {
  return (
    <Link href={href} className={className} onClick={() => trackEvent(event, props)} {...rest}>
      {children}
    </Link>
  );
}
