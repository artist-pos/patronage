"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";
import { OpportunityCTALink } from "@/components/opportunities/OpportunityCTALink";

// The popup (AuthForm, Turnstile, town search) loads only once it's due.
const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

const DISMISSED_KEY = "patronage_before_you_go_dismissed_at";
const DISMISS_SUPPRESS_DAYS = 7;
const POST_SIGNUP_DESTINATION = "/opportunities?tab=for-you";

interface ApplyLink {
  label: string | null;
  url: string;
}

interface Props {
  applyLinks: ApplyLink[];
  opportunityId: string;
  title: string;
  organiser: string;
  isAuthenticated: boolean;
}

/**
 * The external "Apply" link already opens in a new tab (target="_blank" on
 * OpportunityCTALink) — nothing is blocked or delayed. This just adds a
 * prompt on the Patronage tab left behind, at the one moment intent is
 * highest: they've just decided this opportunity is worth applying to.
 * Signed-out visitors only; logged-in users already have a profile.
 *
 * The copy doesn't claim the profile helps with the application they just
 * left for — it doesn't, that one happens elsewhere. It offers the next one.
 */
export function ExternalApplyCTASection({ applyLinks, opportunityId, title, organiser, isAuthenticated }: Props) {
  const [open, setOpen] = useState(false);

  function maybeShow() {
    if (isAuthenticated) return;
    try {
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_SUPPRESS_DAYS * 86_400_000) {
        trackEvent("before_you_go_modal_suppressed", { opportunity_id: opportunityId });
        return;
      }
    } catch {
      // Blocked storage — falls through to showing it, same as a first visit.
    }
    setOpen(true);
    trackEvent("before_you_go_modal_shown", { opportunity_id: opportunityId });
  }

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Best-effort — never block closing the modal.
    }
  }

  return (
    <>
      {applyLinks.map((link, i) => (
        <OpportunityCTALink
          key={`${link.url}-${i}`}
          href={link.url}
          opportunityId={opportunityId}
          title={title}
          organiser={organiser}
          label={`${link.label?.trim() || "Apply"} →`}
          onAfterClick={maybeShow}
          className={
            i === 0
              ? "inline-flex items-center gap-2 bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
              : "inline-flex items-center gap-2 border border-border px-[22px] py-3 text-sm font-medium text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
          }
        />
      ))}

      {open && (
        <SignupPromptModal
          source="before_you_go_external_apply"
          eventPrefix="before_you_go_modal"
          opportunityId={opportunityId}
          heading="Good luck with the opportunity!"
          intro={
            <div className="text-foreground">
              <BlakeNote>
                I hope it goes well. I built Patronage to make finding the next one a little easier. Make a free
                profile and I&rsquo;ll send you the best new ones each week.
              </BlakeNote>
            </div>
          }
          chipsLabel="What do you make?"
          submitLabel="Create my free profile →"
          next={POST_SIGNUP_DESTINATION}
          onClose={close}
        />
      )}
    </>
  );
}
