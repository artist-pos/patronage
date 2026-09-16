"use client";

import { useEffect, useRef, useState } from "react";
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
 * scrolls into view for a signed-out visitor, a modal pops up leading with
 * the medium picker alone; only once they've picked something does the
 * signup form reveal — a small IKEA-effect nudge instead of a flat "sign up"
 * ask. Reuses AuthForm as-is (Google + email/password, same validation and
 * error handling as the real signup page) rather than re-implementing auth.
 * Fires once per page view, and stays quiet for a week after dismissal.
 */
export function OpportunitySignupModalTrigger() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DisciplineEnum[]>([]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    try {
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_SUPPRESS_DAYS * 86_400_000) {
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
          observer.disconnect();
        }
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    trackEvent("opportunities_signup_modal_view", {});
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Best-effort — never block closing the modal.
    }
  }

  // Kept current on every toggle rather than on a single "submit" moment —
  // AuthForm owns its own submit now, so there's no one click to hang this
  // off. /onboarding/role reads the cookie once auth actually succeeds.
  function stash(disciplines: DisciplineEnum[]) {
    const ctx: SignupContext = {
      source: "opportunities_grid_modal",
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
      if (prev.length === 0 && next.length > 0) {
        trackEvent("opportunities_signup_modal_first_pick", {});
      }
      stash(next);
      return next;
    });
  }

  const hasPicked = selected.length > 0;

  return (
    <>
      <div ref={sentinelRef} className="col-span-full h-px" aria-hidden />

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

            <p className="text-lg font-semibold leading-snug">What do you make?</p>
            <p className="mt-1.5 text-sm leading-[1.55] text-muted-foreground">
              Pick a few — we&rsquo;ll match opportunities to your practice. Free, always.
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

            {/* Revealed only once something's picked — the ask lands after
                a bit of investment instead of upfront. */}
            {hasPicked && (
              <div className="mt-6 animate-[pin-in_400ms_ease] border-t border-border pt-6">
                <AuthForm
                  mode="signup"
                  role="artist"
                  next={POST_SIGNUP_DESTINATION}
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
