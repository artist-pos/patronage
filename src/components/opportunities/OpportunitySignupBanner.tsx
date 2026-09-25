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
 * "Get new Painting and Public Art opportunities every week." — named from the
 * listing’s own disciplines, which also seed the new artist’s matching.
 *
 * Rendered only for signed-out visitors — the caller decides that, so the
 * signed-in page never pays for this component at all.
 *
 * The click writes a short-lived cookie rather than stuffing state into the
 * signup URL: the OAuth round-trip drops nested query params (see
 * auth/callback), and this has to survive "Continue with Google".
 */
// "Painting", "Painting and Sculpture", "Painting, Sculpture and Film", or the
// first two "and more" — long lists stop reading as a headline.
function disciplinePhrase(disciplines?: string[] | null): string | null {
  const d = (disciplines ?? []).filter(Boolean);
  if (d.length === 0) return null;
  if (d.length === 1) return d[0];
  if (d.length <= 3) return `${d.slice(0, -1).join(", ")} and ${d[d.length - 1]}`;
  return `${d[0]}, ${d[1]} and more`;
}

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
        <div>
          <p className="text-[14.5px] font-medium leading-[1.55] text-foreground">
            {disciplinePhrase(disciplines)
              ? `Get new ${disciplinePhrase(disciplines)} opportunities every week.`
              : "Get new opportunities like this every week."}
          </p>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-[color:var(--fg-muted)]">
            One email, matched to what you make. Free.
          </p>
        </div>
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
