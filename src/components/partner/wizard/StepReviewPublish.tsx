"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle } from "lucide-react";
import { submitDraftForReview } from "@/app/partner/opportunities/new/actions";
import type { Opportunity } from "@/types/database";
import type { LocalCriterion } from "./RubricBuilder";

interface Props {
  opp: Opportunity;
  criteria: LocalCriterion[];
  isPipeline: boolean;
}

export function StepReviewPublish({ opp, criteria, isPipeline }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = [
    { label: "Title", ok: !!opp.title?.trim() },
    { label: "Organising body", ok: !!opp.organiser?.trim() },
    { label: "Description", ok: !!(opp.full_description?.trim() || opp.description?.trim()) },
    { label: "Country", ok: !!opp.country },
  ];

  const allRequired = checks.every((c) => c.ok);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await submitDraftForReview(opp.id);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.redirectTo) {
      router.push(result.redirectTo);
    }
  }

  const questionCount =
    (opp.pipeline_config?.questions?.length ?? 0);

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Review &amp; publish</h2>
        <p className="text-sm text-stone-500">
          Check everything looks right before submitting for review.
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Required fields</h3>
        <div className="space-y-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CheckCircle className="w-4 h-4 text-black shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-stone-300 shrink-0" />
              )}
              <span className={c.ok ? "" : "text-stone-400"}>{c.label}</span>
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
          <p className="font-semibold text-base">{opp.title || <span className="text-stone-400">No title</span>}</p>
          <p className="text-sm text-stone-500">{opp.organiser || <span className="text-stone-400">No organiser</span>}</p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-stone-500">
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
          <div className="border-t border-black/10 pt-3 flex flex-wrap gap-4 text-xs text-stone-500">
            <span>{questionCount} application question{questionCount !== 1 ? "s" : ""}</span>
            {criteria.length > 0 && (
              <span>{criteria.length} scoring criterion{criteria.length !== 1 ? "a" : ""}</span>
            )}
          </div>
        )}
      </div>

      {/* Pipeline payment note */}
      {isPipeline && !opp.pipeline_paid_at && (
        <div className="border border-black/10 bg-stone-50 p-4 text-sm text-stone-600 space-y-1">
          <p className="font-medium">Payment required</p>
          <p className="text-xs">
            After submitting, you&apos;ll be taken to the payment page. Your listing goes live once reviewed and payment is confirmed ($200 NZD, or free for your first pipeline listing).
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allRequired || submitting}
        className="bg-black text-white text-sm px-6 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-40"
      >
        {submitting
          ? "Submitting…"
          : isPipeline && !opp.pipeline_paid_at
          ? "Submit & proceed to payment →"
          : "Submit for review →"}
      </button>

      {!allRequired && (
        <p className="text-xs text-stone-400">
          Complete the required fields above before submitting.
        </p>
      )}
    </div>
  );
}
