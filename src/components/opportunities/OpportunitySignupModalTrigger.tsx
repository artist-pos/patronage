"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";

// The popup (AuthForm, Turnstile, town search) loads only once it's due.
const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

const POST_SIGNUP_DESTINATION = "/opportunities?tab=for-you";

// Measurement only: how many times this browser has been shown the modal, and
// whether it has dismissed it before. The 7-day suppression was removed on
// 30 Sep, so without this there is no way to see how often the same person is
// asked again. Nothing here changes whether the modal shows.
const VIEWS_KEY = "patronage_opp_signup_modal_views";
const DISMISSED_BEFORE_KEY = "patronage_opp_signup_modal_dismissed_before";

function nextViewStats(): { view_number: string; dismissed_before: string } {
  try {
    const n = (Number(localStorage.getItem(VIEWS_KEY)) || 0) + 1;
    localStorage.setItem(VIEWS_KEY, String(n));
    return { view_number: String(n), dismissed_before: String(localStorage.getItem(DISMISSED_BEFORE_KEY) === "1") };
  } catch {
    return { view_number: "unknown", dismissed_before: "unknown" };
  }
}

/**
 * An invisible sentinel sits inline in the opportunities grid at a fixed
 * scroll depth (wherever the caller places this component — MasonryGrid
 * puts it after the 15th card, roughly the 5th row on desktop). Once it
 * scrolls into view for a signed-out visitor, the signup popup opens.
 * Fires once per page view.
 */
export function OpportunitySignupModalTrigger() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !shownRef.current) {
          shownRef.current = true;
          setOpen(true);
          trackEvent("opportunities_signup_modal_view", nextViewStats());
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
      localStorage.setItem(DISMISSED_BEFORE_KEY, "1");
    } catch {
      // Best-effort: never block closing the modal.
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
