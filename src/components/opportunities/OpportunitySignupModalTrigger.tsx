"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";

// The popup (AuthForm, Turnstile, town search) loads only once it's due.
const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

const DISMISSED_KEY = "patronage_opp_signup_modal_dismissed_at";
const DISMISS_SUPPRESS_DAYS = 7;

// Onboarding's own profile step already skips itself and lands here once
// disciplines + a name are on the profile — passing it explicitly rather
// than relying on that fallback because AuthForm's own default `next`
// ("/profile/edit") would otherwise win first.
const POST_SIGNUP_DESTINATION = "/opportunities?tab=for-you";

/**
 * An invisible sentinel sits inline in the opportunities grid at a fixed
 * scroll depth (wherever the caller places this component — MasonryGrid
 * puts it after the 15th card, roughly the 5th row on desktop). Once it
 * scrolls into view for a signed-out visitor, the signup popup opens.
 * Fires once per page view, and stays quiet for a week after dismissal.
 */
export function OpportunitySignupModalTrigger() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    try {
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_SUPPRESS_DAYS * 86_400_000) {
        trackEvent("opportunities_signup_modal_suppressed", {});
        return;
      }
    } catch {
      // Blocked storage — falls through to showing it, same as a first visit.
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !shownRef.current) {
          shownRef.current = true;
          setOpen(true);
          trackEvent("opportunities_signup_modal_view", {});
          observer.disconnect();
        }
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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
      <div ref={sentinelRef} className="col-span-full h-px" aria-hidden />

      {open && (
        <SignupPromptModal
          source="opportunities_grid_modal"
          eventPrefix="opportunities_signup_modal"
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
          next={POST_SIGNUP_DESTINATION}
          onClose={close}
        />
      )}
    </>
  );
}
