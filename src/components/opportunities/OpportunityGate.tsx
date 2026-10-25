"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";

const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

// False on the server and during hydration, true afterwards: lets the heavy
// signup picker mount only once the page is live, the same way the other
// prompts load on demand. (Rendering a client-only dynamic component straight
// from server HTML left an empty slot on production.)
const subscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(subscribe, () => true, () => false);

interface Props {
  /** How many opportunities sit behind the gate for the current filters. */
  lockedCount: number;
}

const INTRO = (
  <>
    Sign up free to see every grant, residency, commission and open call. Pick what you make and
    we&rsquo;ll send you the best ones each week.
  </>
);

/**
 * Where the free list ends for signed-out visitors. Not dismissible: the rest
 * of the opportunities are one free signup away. Replaces the old card-15 popup
 * on the main browse page.
 *
 * The server renders a plain, working version (heading, copy, signup link) so
 * the gate is there for crawlers and before JavaScript runs; once mounted, the
 * discipline picker and inline signup form replace it.
 */
export function OpportunityGate({ lockedCount }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const mounted = useMounted();

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
      {mounted ? (
        <SignupPromptModal
          inline
          source="opportunities_gate"
          eventPrefix="opportunities_gate"
          heading={`${lockedCount} more open right now`}
          intro={INTRO}
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
      ) : (
        <div className="col-span-full flex justify-center py-6">
          <section className="w-full max-w-md border border-black bg-background p-6 sm:p-8">
            <h2 className="pr-6 text-lg font-semibold leading-snug">{lockedCount} more open right now</h2>
            <p className="mt-1.5 text-sm leading-[1.55] text-muted-foreground">{INTRO}</p>
            <Link
              href="/auth/signup?role=artist&next=%2Fopportunities%3Ftab%3Dfor-you"
              className="mt-5 inline-flex h-10 w-full items-center justify-center bg-brand px-5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Sign up free →
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
