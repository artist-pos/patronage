"use client";

import { ChevronRight } from "lucide-react";
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
}

export function WizardChrome({
  steps,
  currentStep,
  oppId: _oppId,
  type: _type,
  saveStatus,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  isLastStep,
}: Props) {
  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background border-b border-black">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {/* Breadcrumb steps */}
          <div className="flex items-center gap-1 overflow-x-auto min-w-0">
            {steps.map((step, i) => (
              <div key={step.number} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight className="w-3 h-3 text-stone-300 shrink-0" />}
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    step.number === currentStep
                      ? "text-foreground"
                      : step.number < currentStep
                      ? "text-stone-400"
                      : "text-stone-300"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Save status */}
          <span className="text-[11px] text-stone-400 shrink-0">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "idle" && ""}
          </span>
        </div>
      </div>

      {/* Sticky footer nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-black">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
            >
              ← Back
            </button>
          ) : (
            <Link href="/partner/dashboard" className="text-sm text-stone-400 hover:text-foreground transition-colors">
              Cancel
            </Link>
          )}

          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`text-sm px-5 py-2 transition-colors disabled:opacity-40 ${
              isLastStep
                ? "bg-black text-white hover:bg-black/80"
                : "border border-black hover:bg-muted"
            }`}
          >
            {nextLabel ?? (isLastStep ? "Submit for review →" : "Continue →")}
          </button>
        </div>
      </div>
    </>
  );
}
