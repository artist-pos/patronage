"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { stashSignupContext } from "@/lib/signup-context.client";
import type { SignupContext } from "@/lib/signup-context";

interface Props {
  opportunityId: string;
  /** Canonical path of the listing, so signup returns the reader to it. */
  returnTo: string;
  /** Listing disciplines, used to seed the new artist's matching preferences. */
  disciplines?: string[] | null;
  city?: string | null;
  country?: string | null;
  /** Where on the page this instance sits, for event properties. */
  placement?: "detail" | "closed_recovery";
}

/**
 * "Get notified about opportunities like this."
 *
 * Rendered only for signed-out visitors — the caller decides that, so the
 * signed-in page never pays for this component at all.
 *
 * The click writes a short-lived cookie rather than stuffing state into the
 * signup URL: the OAuth round-trip drops nested query params (see
 * auth/callback), and this has to survive "Continue with Google".
 */
export function OpportunitySignupBanner({
  opportunityId,
  returnTo,
  disciplines,
  city,
  country,
  placement = "detail",
}: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  // "View" means actually scrolled into sight, not merely mounted below the fold.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.current) continue;
          seen.current = true;
          observer.disconnect();
          trackEvent("opportunity_page_signup_banner_view", {
            opportunity_id: opportunityId,
            placement,
          });
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [opportunityId, placement]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();

    const ctx: SignupContext = {
      source: "opportunity_page",
      opportunityId,
      ...(disciplines?.length && { disciplines }),
      ...(city && { city }),
      ...(country && { country }),
    };

    try {
      const stored = sessionStorage.getItem("patronage_ref");
      if (stored) ctx.ref = stored;
    } catch {
      // Blocked storage — attribution degrades, signup still works.
    }

    stashSignupContext(ctx);

    trackEvent("opportunity_page_signup_banner_click", {
      opportunity_id: opportunityId,
      placement,
    });

    router.push(
      `/auth/signup?role=artist&next=${encodeURIComponent(returnTo)}`
    );
  }

  return (
    <div
      ref={ref}
      className="mt-9 border-t border-border pt-6"
    >
      <div className="flex flex-col gap-3 bg-[color:var(--brand-sub)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-[14.5px] leading-[1.55] text-foreground">
          get notified about opportunities like this.
        </p>
        <a
          href={`/auth/signup?role=artist&next=${encodeURIComponent(returnTo)}`}
          onClick={handleClick}
          className="inline-flex shrink-0 items-center justify-center bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Sign up free →
        </a>
      </div>
    </div>
  );
}
