"use client";

import Link from "next/link";

interface Step {
  number: number;
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: number;
  oppId: string;
  type: string;
  saveStatus: "idle" | "saving" | "saved";
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  isLastStep?: boolean;
  anonymous?: boolean;
}

export function WizardChrome({
  steps,
  currentStep,
  oppId,
  type: _type,
  saveStatus,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  isLastStep,
  anonymous = false,
}: Props) {
  const saveLabel = anonymous
    ? "Saved on this device"
    : saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "";
  const exitHref = anonymous ? "/partners" : "/dashboard";

  return (
    <>
      {/* Sticky header */}
      <div className="ams-comfort sticky top-0 z-30 bg-background border-b border-black/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 min-h-16 py-2 flex items-center justify-between gap-4 sm:gap-8">
          {/* Left: exit link */}
          <Link
            href={exitHref}
            className="text-base font-medium text-stone-700 hover:text-foreground transition-colors shrink-0 whitespace-nowrap"
          >
            ← Leave
          </Link>

          {/* Center: step indicators */}
          <div className="flex items-center gap-0 flex-1 justify-center overflow-x-auto">
            {steps.map((step, i) => {
              const done = step.number < currentStep;
              const active = step.number === currentStep;
              return (
                <div key={step.number} className="flex items-center shrink-0">
                  {i > 0 && (
                    <div
                      className={`w-4 sm:w-10 h-0.5 mx-1 ${done ? "bg-black" : "bg-stone-200"}`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className={`w-9 h-9 flex items-center justify-center text-base font-semibold border transition-colors ${
                        done
                          ? "bg-brand border-brand text-brand-foreground"
                          : active
                          ? "border-brand text-black"
                          : "border-stone-300 text-stone-500"
                      }`}
                    >
                      {done ? "✓" : step.number}
                    </div>
                    <span
                      className={`text-sm sm:text-base font-medium whitespace-nowrap transition-colors ${
                        active ? "text-foreground font-semibold" : done ? "text-stone-700" : "text-stone-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: save + preview */}
          <div className="flex items-center gap-2 shrink-0">
            {saveLabel && (
              <span className="text-sm text-stone-500 hidden sm:block">{saveLabel}</span>
            )}
            {!anonymous && (
              <Link
                href={`/opportunities/${oppId}`}
                target="_blank"
                className="text-sm border border-black/20 px-3 py-1.5 hover:border-black transition-colors hidden sm:block"
              >
                See it as an artist
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer nav */}
      <div className="ams-comfort fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-black/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {currentStep > steps[0].number ? (
            <button
              type="button"
              onClick={onBack}
              className="text-base border border-black/40 px-6 py-3 hover:border-black transition-colors"
            >
              ← Back
            </button>
          ) : (
            <Link
              href={exitHref}
              className="text-sm text-stone-500 hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
          )}

          <span className="text-sm text-stone-600 hidden sm:block">
            {saveLabel || "Your work saves as you go"}
          </span>

          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`text-base px-8 py-3 font-semibold transition-colors disabled:opacity-40 ${
              isLastStep
                ? "bg-brand text-brand-foreground hover:bg-brand/90"
                : "border border-brand hover:bg-stone-50"
            }`}
          >
            {nextLabel ?? (isLastStep ? "Send to us to check →" : "Next →")}
          </button>
        </div>
      </div>
    </>
  );
}
