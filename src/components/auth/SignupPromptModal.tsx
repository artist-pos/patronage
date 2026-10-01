"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { stashSignupContext } from "@/lib/signup-context.client";
import type { SignupContext } from "@/lib/signup-context";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";
import { AuthForm } from "@/components/auth/AuthForm";
import type { DisciplineEnum } from "@/types/database";

// "other" doesn't round-trip through toDisciplineEnums (no regex matches the
// literal word "other", so it would silently drop) and isn't a meaningful
// medium chip anyway — the profile editor keeps it as a catch-all, this
// doesn't need one.
const CHIP_DISCIPLINES = DISCIPLINE_OPTIONS.filter((d) => d.value !== "other");

interface Props {
  /** Attribution for the signup context and AuthForm, e.g. "opportunities_grid_modal". */
  source: string;
  /** Prefix for this surface's own events: `${prefix}_first_pick`, `${prefix}_dismissed`.
   *  The caller tracks the view, since only it knows what counts as one. */
  eventPrefix: string;
  opportunityId?: string;
  heading: string;
  /** Under the heading, always visible. */
  intro: React.ReactNode;
  /** Label above the chips, when the heading isn't already the question. */
  chipsLabel?: string;
  /** Just above the signup form, once it's revealed. */
  note?: React.ReactNode;
  submitLabel: string;
  /** Where the new artist lands once onboarding is done. */
  next: string;
  onClose: () => void;
  /** When set, renders a secondary link below the form to skip signup entirely. */
  skipLabel?: string;
  onSkip?: () => void;
}

/**
 * The artist signup popup behind every opportunity-side prompt: what you make →
 * signup. The form stays hidden until something is picked — a small IKEA-effect
 * nudge instead of a flat "sign up" ask. Disciplines are stashed in the
 * signup-context cookie so /onboarding/role writes them to the profile.
 *
 * Location is collected at /onboarding/profile after signup, not here.
 */
export default function SignupPromptModal({
  source,
  eventPrefix,
  opportunityId,
  heading,
  intro,
  chipsLabel,
  note,
  submitLabel,
  next,
  onClose,
  skipLabel,
  onSkip,
}: Props) {
  const titleId = useId();
  const [selected, setSelected] = useState<DisciplineEnum[]>([]);
  const firstPickTracked = useRef(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kept current on every answer rather than on a single "submit" moment —
  // AuthForm owns its own submit, so there's no one click to hang this off.
  useEffect(() => {
    if (selected.length === 0) return;
    const ctx: SignupContext = {
      source,
      ...(opportunityId && { opportunityId }),
      disciplines: selected,
    };
    try {
      const stored = sessionStorage.getItem("patronage_ref");
      if (stored) ctx.ref = stored;
    } catch {
      // Blocked storage — attribution degrades, signup still works.
    }
    stashSignupContext(ctx);
  }, [source, opportunityId, selected]);

  function dismiss() {
    trackEvent(`${eventPrefix}_dismissed`, {
      had_picked: String(selected.length > 0),
      ...(opportunityId && { opportunity_id: opportunityId }),
    });
    onClose();
  }

  function toggle(d: DisciplineEnum) {
    setSelected((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
    if (!firstPickTracked.current) {
      firstPickTracked.current = true;
      trackEvent(`${eventPrefix}_first_pick`, opportunityId ? { opportunity_id: opportunityId } : {});
    }
  }

  const hasPicked = selected.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 p-4 backdrop-blur-md"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto border border-black bg-background p-6 sm:p-8"
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

        <p id={titleId} className="pr-6 text-lg font-semibold leading-snug">
          {heading}
        </p>
        <div className="mt-1.5 text-sm leading-[1.55] text-muted-foreground">{intro}</div>

        {chipsLabel && <p className="mt-6 text-sm font-medium">{chipsLabel}</p>}
        <div className={`${chipsLabel ? "mt-2.5" : "mt-5"} flex flex-wrap gap-1.5`}>
          {CHIP_DISCIPLINES.map(({ value, label }) => {
            const active = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
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

        {/* Revealed only once something's picked — the ask lands after a bit
            of investment instead of upfront. */}
        {hasPicked && (
          <div className="mt-6 animate-[pin-in_400ms_ease] border-t border-border pt-6">
            {note && <div className="mb-6 text-sm leading-[1.6]">{note}</div>}
            <AuthForm
              mode="signup"
              role="artist"
              next={next}
              analyticsSource={source}
              submitClassName="w-full bg-brand text-white hover:bg-brand/90"
              submitLabel={submitLabel}
            />
          </div>
        )}

        {skipLabel && onSkip && (
          <p className="mt-5 text-center">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              {skipLabel}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
