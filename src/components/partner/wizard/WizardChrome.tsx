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
    : saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Auto-saved" : "";
  const exitHref = anonymous ? "/partners" : "/partner/dashboard";

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background border-b border-black/10">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between gap-8">
          {/* Left: exit link */}
          <Link
            href={exitHref}
            className="text-xs text-stone-400 hover:text-foreground transition-colors shrink-0 whitespace-nowrap"
          >
            ← Exit setup
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
                      className={`w-8 h-px mx-1 ${done ? "bg-black" : "bg-stone-200"}`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors ${
                        done
                          ? "bg-black border-black text-white"
                          : active
                          ? "border-black text-black"
                          : "border-stone-300 text-stone-400"
                      }`}
                    >
                      {done ? "✓" : step.number}
                    </div>
                    <span
                      className={`text-[10px] font-medium whitespace-nowrap transition-colors ${
                        active ? "text-foreground" : done ? "text-stone-500" : "text-stone-300"
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
              <span className="text-[11px] text-stone-400 hidden sm:block">{saveLabel}</span>
            )}
            {!anonymous && (
              <Link
                href={`/opportunities/${oppId}`}
                target="_blank"
                className="text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors hidden sm:block"
              >
                Preview as artist
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-black/10">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {currentStep > steps[0].number ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm border border-black/20 px-4 py-2 hover:border-black transition-colors"
            >
              ← Back
            </button>
          ) : (
            <Link
              href={exitHref}
              className="text-sm text-stone-400 hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
          )}

          <span className="text-[11px] text-stone-400 hidden sm:block">
            {saveLabel || ""}
          </span>

          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`text-sm px-6 py-2 font-medium transition-colors disabled:opacity-40 ${
              isLastStep
                ? "bg-black text-white hover:bg-black/80"
                : "border border-black hover:bg-stone-50"
            }`}
          >
            {nextLabel ?? (isLastStep ? "Submit for review →" : "Continue →")}
          </button>
        </div>
      </div>
    </>
  );
}
