"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";

const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

// A visitor who has seen any signup prompt this session, or an exit prompt in the
// last week, is not asked again. Shared with ExternalApplyCTASection.
export const PROMPT_SEEN_SESSION_KEY = "patronage_signup_prompt_seen";
const LAST_SHOWN_KEY = "patronage_exit_intent_last_shown";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
// Don't fire on someone who has barely arrived.
const MIN_DWELL_MS = 8_000;

function alreadyAsked(): boolean {
  try {
    if (sessionStorage.getItem(PROMPT_SEEN_SESSION_KEY)) return true;
    const last = Number(localStorage.getItem(LAST_SHOWN_KEY)) || 0;
    return Date.now() - last < COOLDOWN_MS;
  } catch {
    return false;
  }
}

interface Props {
  opportunityId: string;
}

/**
 * Signed-out visitors on an open opportunity page. Desktop: the pointer leaves
 * through the top of the window (towards the tab bar or back button). Mobile has
 * no pointer to follow, so the prompt waits for them to come back to the tab
 * after switching away. Shown once a week, and never on top of another prompt.
 */
export function ExitIntentPrompt({ opportunityId }: Props) {
  const [open, setOpen] = useState(false);
  const mountedAt = useRef(0);
  const fired = useRef(false);

  useEffect(() => {
    mountedAt.current = Date.now();
    function show(trigger: "mouse_leave" | "tab_return") {
      if (fired.current || alreadyAsked()) return;
      if (Date.now() - mountedAt.current < MIN_DWELL_MS) return;
      fired.current = true;
      try {
        sessionStorage.setItem(PROMPT_SEEN_SESSION_KEY, "1");
        localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
      } catch {
        // Storage blocked — the in-memory flag still stops a repeat this page view.
      }
      setOpen(true);
      trackEvent("exit_intent_modal_view", { opportunity_id: opportunityId, trigger });
    }

    function onMouseOut(e: MouseEvent) {
      if (e.relatedTarget === null && e.clientY <= 0) show("mouse_leave");
    }

    let wasHidden = false;
    function onVisibility() {
      if (document.visibilityState === "hidden") wasHidden = true;
      else if (wasHidden) show("tab_return");
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (finePointer) document.addEventListener("mouseout", onMouseOut);
    else document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [opportunityId]);

  if (!open) return null;

  return (
    <SignupPromptModal
      source="opportunity_exit_intent"
      eventPrefix="exit_intent_modal"
      opportunityId={opportunityId}
      heading="Don't lose track of this one"
      intro={
        <>
          Make a free profile and we&rsquo;ll email you before opportunities you save close, plus the best new ones
          for your practice each week.
        </>
      }
      chipsLabel="What do you make?"
      note={
        <BlakeNote>
          I built Patronage to make finding opportunities a little easier. I&rsquo;d love to have you in the community.
        </BlakeNote>
      }
      submitLabel="Create my free profile →"
      next="/opportunities?tab=for-you"
      onClose={() => setOpen(false)}
    />
  );
}
