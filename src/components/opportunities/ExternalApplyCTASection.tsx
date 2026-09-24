"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { stashSignupContext } from "@/lib/signup-context.client";
import type { SignupContext } from "@/lib/signup-context";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";
import { AuthForm } from "@/components/auth/AuthForm";
import { OpportunityCTALink } from "@/components/opportunities/OpportunityCTALink";
import type { DisciplineEnum } from "@/types/database";

const CHIP_DISCIPLINES = DISCIPLINE_OPTIONS.filter((d) => d.value !== "other");

const DISMISSED_KEY = "patronage_before_you_go_dismissed_at";
const DISMISS_SUPPRESS_DAYS = 7;
const ANALYTICS_SOURCE = "before_you_go_external_apply";
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
 */
export function ExternalApplyCTASection({ applyLinks, opportunityId, title, organiser, isAuthenticated }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DisciplineEnum[]>([]);

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

  function dismiss() {
    setOpen(false);
    trackEvent("before_you_go_modal_dismissed", {
      opportunity_id: opportunityId,
      had_picked: String(selected.length > 0),
    });
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Best-effort — never block closing the modal.
    }
  }

  function stash(disciplines: DisciplineEnum[]) {
    const ctx: SignupContext = {
      source: ANALYTICS_SOURCE,
      opportunityId,
      ...(disciplines.length > 0 && { disciplines }),
    };
    try {
      const stored = sessionStorage.getItem("patronage_ref");
      if (stored) ctx.ref = stored;
    } catch {
      // Blocked storage — attribution degrades, signup still works.
    }
    stashSignupContext(ctx);
  }

  function toggle(d: DisciplineEnum) {
    setSelected((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      stash(next);
      return next;
    });
  }

  const hasPicked = selected.length > 0;

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 p-4 backdrop-blur-md"
          onClick={dismiss}
        >
          <div
            className="relative w-full max-w-md border border-black bg-background p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-3 top-3 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-lg font-semibold leading-snug">Don&rsquo;t miss the next one.</p>
            <p className="mt-1.5 text-sm leading-[1.55] text-muted-foreground">
              Pick a few. We&rsquo;ll find the grants, residencies, commissions and open calls that fit your practice and send you the best ones each week.
            </p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {CHIP_DISCIPLINES.map(({ value, label }) => {
                const active = selected.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggle(value)}
                    className={`border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-white"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {hasPicked && (
              <div className="mt-6 animate-[pin-in_400ms_ease] border-t border-border pt-6">
                <AuthForm
                  mode="signup"
                  role="artist"
                  next={POST_SIGNUP_DESTINATION}
                  analyticsSource={ANALYTICS_SOURCE}
                  submitClassName="w-full bg-brand text-white hover:bg-brand/90"
                  submitLabel="Sign up free →"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
