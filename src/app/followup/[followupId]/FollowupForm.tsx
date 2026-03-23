"use client";

import { useActionState } from "react";
import { submitFollowup, type FollowupFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { INCOME_CHANGE_OPTIONS } from "@/lib/constants/demographics";

interface Props {
  followupId: string;
}

export function FollowupForm({ followupId }: Props) {
  const [state, action, isPending] = useActionState<FollowupFormState, FormData>(
    submitFollowup.bind(null, followupId),
    {}
  );

  if (state.success) {
    return (
      <div className="border border-black p-6 space-y-3 text-center">
        <p className="text-lg font-semibold">Ngā mihi — thank you!</p>
        <p className="text-sm text-muted-foreground">
          Your update has been submitted. It will be used in aggregate reporting to show the real impact of arts funding on artists&rsquo; careers.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <label htmlFor="further_opportunities" className="text-sm font-medium block">
          Have you won or been shortlisted for any other opportunities since?
        </label>
        <textarea
          id="further_opportunities"
          name="further_opportunities"
          rows={3}
          placeholder="e.g. Shortlisted for Creative NZ Toi Uru Kahikatea, applied for three residencies…"
          className="w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none resize-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="exhibitions" className="text-sm font-medium block">
          Have you exhibited or shown work since?
        </label>
        <textarea
          id="exhibitions"
          name="exhibitions"
          rows={3}
          placeholder="e.g. Group show at Objectspace, Auckland; solo exhibition at regional gallery…"
          className="w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none resize-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="press_coverage" className="text-sm font-medium block">
          Have you received any press or media coverage?
        </label>
        <textarea
          id="press_coverage"
          name="press_coverage"
          rows={3}
          placeholder="e.g. Feature in Pantograph Punch, interview on RNZ…"
          className="w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none resize-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="income_from_practice" className="text-sm font-medium block">
          How has your income from creative practice changed?
        </label>
        <select
          id="income_from_practice"
          name="income_from_practice"
          className="w-full border border-black bg-background px-3 py-2 text-sm focus-visible:outline-none"
        >
          <option value="">— Select —</option>
          {INCOME_CHANGE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="community_projects" className="text-sm font-medium block">
          Have you been involved in any community projects?
        </label>
        <textarea
          id="community_projects"
          name="community_projects"
          rows={3}
          placeholder="e.g. Youth arts workshop, mural commission for local council…"
          className="w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none resize-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="testimonial" className="text-sm font-medium block">
          Is there anything you&rsquo;d like to share about the impact of this opportunity?
        </label>
        <textarea
          id="testimonial"
          name="testimonial"
          rows={4}
          placeholder="e.g. This residency gave me time and space to develop a body of work I wouldn't otherwise have been able to create…"
          className="w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="testimonial_consent"
            className="mt-0.5 border-black shrink-0"
          />
          <span className="text-sm">
            You may use my words above in impact reporting, publications, and partner communications (with my name attributed).
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor="additional_notes" className="text-sm font-medium block">
          Anything else you&rsquo;d like to add? <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          id="additional_notes"
          name="additional_notes"
          rows={3}
          placeholder="Any other notes or context…"
          className="w-full border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none resize-none"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit update"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Your responses are used only for anonymised, aggregate impact reporting. Individual responses are never shared with funders unless you tick the consent box above.
      </p>
    </form>
  );
}
