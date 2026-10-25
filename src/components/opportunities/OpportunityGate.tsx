"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";

// Split into its own chunk but still rendered on the server: the gate is page
// content, so it must be in the HTML (crawlers, no-JS, first paint). `ssr: false`
// left an empty client-only slot here on the production build.
const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"));

interface Props {
  /** How many opportunities sit behind the gate for the current filters. */
  lockedCount: number;
}

/**
 * Where the free list ends for signed-out visitors. Not dismissible: the rest
 * of the opportunities are one free signup away. Replaces the old card-15 popup
 * on the main browse page.
 */
export function OpportunityGate({ lockedCount }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !seen.current) {
        seen.current = true;
        trackEvent("opportunities_gate_view", { locked_count: String(lockedCount) });
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [lockedCount]);

  return (
    <div ref={ref} className="col-span-full">
      <SignupPromptModal
        inline
        source="opportunities_gate"
        eventPrefix="opportunities_gate"
        heading={`${lockedCount} more open right now`}
        intro={
          <>
            Sign up free to see every grant, residency, commission and open call. Pick what you make and
            we&rsquo;ll send you the best ones each week.
          </>
        }
        note={
          <BlakeNote>
            I built Patronage to make finding opportunities to apply for a little easier. Make a free profile to
            keep your bio, CV and work in one place. I&rsquo;d love to have you in the community.
          </BlakeNote>
        }
        submitLabel="Sign up free →"
        next="/opportunities?tab=for-you"
        onClose={() => {}}
      />
    </div>
  );
}
