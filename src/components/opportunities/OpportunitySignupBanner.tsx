"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";

// The popup (AuthForm, Turnstile, town search) loads only on click.
const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

interface Props {
  opportunityId: string;
  /** Canonical path of the listing, so signup returns the reader to it. */
  returnTo: string;
  /** Listing disciplines, used only to name the headline. */
  disciplines?: string[] | null;
  /** Where on the page this instance sits, for event properties. */
  placement?: "detail" | "closed_recovery";
}

/**
 * "Get new Painting and Public Art opportunities every week." — named from the
 * listing’s own disciplines.
 *
 * Rendered only for signed-out visitors — the caller decides that, so the
 * signed-in page never pays for this component at all.
 *
 * The click opens the signup popup in place rather than sending the reader to
 * /auth/signup: leaving the listing they were reading lost most of them
 * (193 views → 2 clicks, Sept 2026), while the in-place popups convert.
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
  placement = "detail",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const [open, setOpen] = useState(false);

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
    trackEvent("opportunity_page_signup_banner_click", {
      opportunity_id: opportunityId,
      placement,
    });
    setOpen(true);
  }

  const phrase = disciplinePhrase(disciplines);

  return (
    <div
      ref={ref}
      className="mt-9 border-t border-border pt-6"
    >
      <div className="flex flex-col gap-3 bg-[color:var(--brand-sub)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-[14.5px] font-medium leading-[1.55] text-foreground">
            {phrase
              ? `Get new ${phrase} opportunities every week.`
              : "Get new opportunities like this every week."}
          </p>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-[color:var(--fg-muted)]">
            One email, matched to what you make. Free.
          </p>
        </div>
        {/* A real link underneath, so it still works before hydration. */}
        <a
          href={`/auth/signup?role=artist&next=${encodeURIComponent(returnTo)}`}
          onClick={handleClick}
          className="inline-flex shrink-0 items-center justify-center bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Sign up free →
        </a>
      </div>

      {open && (
        <SignupPromptModal
          source="opportunity_page"
          eventPrefix="opportunity_page_signup_modal"
          opportunityId={opportunityId}
          heading="What do you make?"
          intro={
            <>
              Pick a few. We&rsquo;ll find the grants, residencies, commissions and open calls that fit your
              practice and send you the best ones each week.
            </>
          }
          note={
            <BlakeNote>
              I built Patronage to make finding opportunities to apply for a little easier. Make a free profile to
              keep your bio, CV and work in one place. I&rsquo;d love to have you in the community.
            </BlakeNote>
          }
          submitLabel="Sign up free →"
          next={returnTo}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
