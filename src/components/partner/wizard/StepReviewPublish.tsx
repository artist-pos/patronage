"use client";

import { CheckCircle, Circle } from "lucide-react";
import type { Opportunity } from "@/types/database";
import type { LocalCriterion } from "./RubricBuilder";

interface Props {
  opp: Opportunity;
  criteria: LocalCriterion[];
  isPipeline: boolean;
  submitError?: string | null;
}

export function StepReviewPublish({ opp, criteria, isPipeline, submitError }: Props) {
  const checks = [
    { label: "Title", ok: !!opp.title?.trim() },
    { label: "Organising body", ok: !!opp.organiser?.trim() },
    { label: "Description", ok: !!(opp.full_description?.trim() || opp.description?.trim()) },
    { label: "Country", ok: !!opp.country },
  ];

  const questionCount =
    (opp.pipeline_config?.questions?.length ?? 0);

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Check everything, then send it to us</h2>
        <p className="text-sm text-stone-500">
          Have a quick look. When you are happy, press the button at the bottom. Nothing goes public until we have checked it.
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Things we need</h3>
        <div className="space-y-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CheckCircle className="w-4 h-4 text-black shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-stone-400 shrink-0" />
              )}
              <span className={c.ok ? "" : "text-stone-500"}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="border border-black/10 p-5 space-y-4">
        {opp.featured_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opp.featured_image_url}
            alt=""
            className="w-full max-h-40 object-cover"
          />
        )}

        <div className="space-y-1">
          <p className="font-semibold text-base">{opp.title || <span className="text-stone-500">No title</span>}</p>
          <p className="text-sm text-stone-500">{opp.organiser || <span className="text-stone-500">No organiser</span>}</p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-stone-500">
          <span>{opp.type}</span>
          {opp.country && <span>{opp.country}</span>}
          {opp.city && <span>{opp.city}</span>}
          {opp.deadline && <span>Closes {opp.deadline.slice(0, 10)}</span>}
          {opp.funding_range && <span>{opp.funding_range}</span>}
        </div>

        {(opp.caption || opp.full_description) && (
          <p className="text-sm text-stone-600 line-clamp-3">
            {opp.caption || opp.full_description}
          </p>
        )}

        {isPipeline && (
          <div className="border-t border-black/10 pt-3 flex flex-wrap gap-4 text-sm text-stone-500">
            <span>{questionCount} application question{questionCount !== 1 ? "s" : ""}</span>
            {criteria.length > 0 && (
              <span>{criteria.length} scoring {criteria.length !== 1 ? "criteria" : "criterion"}</span>
            )}
          </div>
        )}
      </div>

      {/* Pipeline payment note */}
      {isPipeline && !opp.pipeline_paid_at && (
        <div className="border border-black p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-widest text-stone-500">Publishing fee</p>
            <p className="font-semibold">What you get</p>
          </div>

          <div className="space-y-2">
            {[
              "Custom application questions",
              "Review applications as a list, a board or one by one",
              "Score applications with your team",
              "Results held until you are ready to send them",
              "Collect final files from chosen artists",
              "6 and 12-month follow-ups with chosen artists",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm">
                <span className="text-stone-400 shrink-0 mt-0.5">–</span>
                <span className="text-stone-600">{item}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-black/10 pt-3 flex items-baseline justify-between">
            <span className="text-sm text-stone-500">One-off publishing fee</span>
            <span className="text-lg font-semibold">$200 NZD</span>
          </div>
          <p className="text-sm text-stone-500">
            We review every open call before it goes live and confirm any publishing fee with you then. Your first one is on us.
          </p>
        </div>
      )}

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      <p className="text-sm text-stone-500">
        {isPipeline && !opp.pipeline_paid_at
          ? "After submitting, we review your listing, usually within two business days, and email you when it is live or if a publishing fee applies."
          : "Once submitted, your listing will be reviewed within two business days."}
      </p>
    </div>
  );
}
