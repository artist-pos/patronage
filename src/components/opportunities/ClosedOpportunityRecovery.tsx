"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export interface RecoverySuggestion {
  id: string;
  href: string;
  title: string;
  organiser: string;
  type: string;
  location: string | null;
  value: string | null;
  deadline: string | null;
  imageUrl: string | null;
}

interface Props {
  opportunityId: string;
  suggestions: RecoverySuggestion[];
}

/**
 * What a reader sees instead of a dead end.
 *
 * A closed listing is still worth landing on — it is usually how someone
 * arrives from search months later. Rather than confirming the bad news and
 * stopping, this hands them live work in the same shape.
 */
export function ClosedOpportunityRecovery({ opportunityId, suggestions }: Props) {
  const ref = useRef<HTMLElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.current) continue;
          seen.current = true;
          observer.disconnect();
          trackEvent("closed_opportunity_recovery_view", {
            opportunity_id: opportunityId,
            suggestion_count: String(suggestions.length),
          });
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [opportunityId, suggestions.length]);

  function handleClick(suggestionId: string) {
    trackEvent("closed_opportunity_recovery_click", {
      opportunity_id: opportunityId,
      clicked_opportunity_id: suggestionId,
    });
  }

  return (
    <section ref={ref} className="mt-8 border-t border-border pt-7">
      <p className="mb-1 text-[15px] font-semibold">This opportunity has closed.</p>
      <p className="mb-5 text-[14px] text-[color:var(--fg-muted)]">
        You might be interested in:
      </p>

      <div className="grid grid-cols-1 gap-[2px] bg-feed-bg sm:grid-cols-2">
        {suggestions.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            onClick={() => handleClick(s.id)}
            className="flex gap-3 bg-card p-3 transition-colors hover:bg-[color:var(--tint)]"
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-white">
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.imageUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="px-1 text-center font-mono text-[8px] font-semibold uppercase text-[color:var(--fg-subtle)]">
                  {s.type}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                {s.organiser}
              </p>
              <p className="mb-1 text-[13.5px] font-semibold leading-[1.35]">{s.title}</p>
              <p className="truncate text-[12px] text-[color:var(--fg-muted)]">
                {[s.location, s.type, s.value].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-0.5 text-[12px] text-[color:var(--fg-subtle)]">
                {s.deadline ? `Closes ${s.deadline}` : "Rolling deadline"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
