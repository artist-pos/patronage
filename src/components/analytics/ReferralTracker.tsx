"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";

/** Where the ref is parked so a later signup in the same session can claim it. */
export const REFERRAL_SESSION_KEY = "patronage_ref";

/**
 * Catches every arrival carrying a `?ref=` param.
 *
 * Mounted once in the root layout, so a referral is recorded wherever it lands
 * — an opportunity, a profile, a regional page. The value is also parked in
 * sessionStorage, which is what lets referral_signup attribute an account
 * created several pages later to the link that brought the person in.
 */
export function ReferralTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref || !pathname) return;

    // An opportunity URL is /opportunities/<slug>. Anything deeper or shallower
    // is a browse surface, not a listing.
    const segments = pathname.split("/").filter(Boolean);
    const opportunityId =
      segments[0] === "opportunities" && segments.length === 2 ? segments[1] : null;

    // Only the first ref of a session wins. A reader who follows two shared
    // links should stay attributed to the one that actually brought them in.
    let alreadySeen = false;
    try {
      alreadySeen = !!sessionStorage.getItem(REFERRAL_SESSION_KEY);
      if (!alreadySeen) {
        sessionStorage.setItem(REFERRAL_SESSION_KEY, ref);
        if (opportunityId) {
          sessionStorage.setItem("patronage_ref_opportunity", opportunityId);
        }
      }
    } catch {
      // Private mode. The visit event still fires; only the later signup
      // attribution is lost.
    }

    if (alreadySeen) return;

    ph.capture("referral_visit", {
      ref_source: ref,
      landing_page: pathname,
      ...(opportunityId && { opportunity_id: opportunityId }),
    });

    if (opportunityId) {
      ph.capture("opportunity_referral_visit", {
        ref_source: ref,
        opportunity_id: opportunityId,
      });
    }
  }, [pathname, searchParams, ph]);

  return null;
}
