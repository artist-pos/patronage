"use client";

import { Check } from "lucide-react";
import { LIFE_STAGES, type NextStep, type NextTarget } from "@/lib/next-step";

interface Props {
  step: NextStep;
  onAction: (target: NextTarget) => void;
  /** Viewers and reviewers can't act on most steps, so the buttons are hidden. */
  canAct: boolean;
}

/** The first thing on the page: where this call is, and the one thing to do next. */
export function NextStepBanner({ step, onAction, canAct }: Props) {
  return (
    <section aria-label="What to do next" className="border border-black bg-white">
      <ol className="grid grid-cols-2 border-b border-black/10 sm:grid-cols-4" aria-label="Progress">
        {LIFE_STAGES.map((label, i) => {
          const done = i < step.stage || (step.stage === 3 && i === 3);
          const current = i === step.stage && !done;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-2 px-4 py-3 text-sm ${current ? "bg-stone-100 font-semibold text-foreground" : done ? "text-stone-700" : "text-stone-500"}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-sm font-semibold ${done ? "border-brand bg-brand text-brand-foreground" : current ? "border-brand" : "border-stone-400"}`}
                aria-hidden
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span>{label}</span>
              {done && <span className="sr-only"> (done)</span>}
              {current && <span className="sr-only"> (you are here)</span>}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 max-w-2xl space-y-1">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-stone-600">Next step</p>
          <h2 className="text-xl font-semibold leading-snug tracking-tight">{step.headline}</h2>
          <p className="text-base leading-relaxed text-stone-600">{step.detail}</p>
        </div>
        {canAct && (step.action || step.alternative) && (
          <div className="flex flex-wrap items-center gap-3">
            {step.alternative && (
              <button
                type="button"
                onClick={() => onAction(step.alternative!.target)}
                className="border border-black px-5 py-3 text-base font-medium hover:bg-stone-100"
              >
                {step.alternative.label}
              </button>
            )}
            {step.action && (
              <button
                type="button"
                onClick={() => onAction(step.action!.target)}
                className="bg-brand px-6 py-3 text-base font-semibold text-brand-foreground hover:bg-brand/90"
              >
                {step.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
