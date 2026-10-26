"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";
import { TYPE_LABELS } from "@/lib/opportunity-constants";

// Split into its own chunk but still rendered on the server: the gate is page
// content, so it must be in the HTML (crawlers, no-JS, first paint). `ssr: false`
// left an empty client-only slot here on the production build.
const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"));

export interface LockedSummary {
  /** Locked listings with a deadline in the next 14 days. */
  closingSoon: number;
  /** Shape-only stand-ins for the blurred cards; nothing that identifies a listing. */
  teasers: { type: string; country: string; deadline: string | null }[];
}

interface Props {
  /** How many opportunities sit behind the gate for the current filters. */
  lockedCount: number;
  summary?: LockedSummary;
}

/**
 * Where the free list ends for signed-out visitors. Not dismissible: the rest
 * of the opportunities are one free signup away. Replaces the old card-15 popup
 * on the main browse page.
 */
export function OpportunityGate({ lockedCount, summary }: Props) {
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


  const teasers = summary?.teasers ?? [];

  return (
    <div ref={ref} className="relative col-span-full mt-2 min-h-[640px]">
      {/* The rest of the list, blurred and unreadable: only shapes, no titles. The prompt below stays pinned on top while this scrolls. */}
      {teasers.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none grid select-none grid-cols-1 gap-4 blur-[5px] md:grid-cols-2 lg:grid-cols-3"
        >
          {teasers.map((t, i) => (
            <div key={i} className="border border-border bg-background">
              <div className="h-[200px] bg-stone-300" />
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-stone-200 px-3 py-1 text-xs text-stone-700">{TYPE_LABELS[t.type] ?? t.type}</span>
                  <span className="text-xs text-stone-500">{t.country}</span>
                </div>
                <div className="h-4 w-4/5 bg-stone-400" />
                <div className="h-3 w-1/2 bg-stone-300" />
                <div className="h-3 w-full bg-stone-200" />
                <div className="h-3 w-2/3 bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto mx-auto w-full max-w-md pt-[4vh] drop-shadow-xl[@media(min-height:1000px)]:sticky [@media(min-height:1000px)]:top-4">
      <SignupPromptModal
        inline
        formFirst
        source="opportunities_gate"
        eventPrefix="opportunities_gate"
        heading={`${lockedCount} more open right now`}
        intro={
          <>
            {summary && summary.closingSoon > 0 && (
              <span className="mb-2 block text-foreground">{summary.closingSoon} closing in the next two weeks.</span>
            )}
            Join free, no card needed, to see the full list and get the best matches for you each week.
          </>
        }
        note={
          <BlakeNote>
            I built Patronage to make finding opportunities a little easier. I&rsquo;d love to have you in the community.
          </BlakeNote>
        }
        submitLabel={`Show me all ${lockedCount} →`}
        next="/opportunities?tab=for-you"
        onClose={() => {}}
      />
        </div>
      </div>
    </div>
  );
}
