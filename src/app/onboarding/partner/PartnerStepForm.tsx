"use client";

import { useActionState } from "react";
import { CombinedLocationPicker } from "@/components/profile/CombinedLocationPicker";
import { ORG_CATEGORIES } from "@/lib/org-categories";
import { saveOnboardingPartner, type PartnerStepState } from "./actions";
import type { OrgCategory } from "@/lib/org-categories";
import type { CityWithRegion, LocalBoard } from "@/types/database";

interface Props {
  cities: CityWithRegion[];
  boards: LocalBoard[];
  defaultLocalBoardId: string | null;
  defaultCountry: string;
  defaultCity: string;
  defaultCityId: string | null;
  defaultRegionId: string | null;
  defaultOrgCategory: OrgCategory | null;
  next: string | null;
}

export function PartnerStepForm({
  cities,
  boards,
  defaultLocalBoardId,
  defaultCountry,
  defaultCity,
  defaultCityId,
  defaultRegionId,
  defaultOrgCategory,
  next,
}: Props) {
  const [state, formAction, pending] = useActionState<PartnerStepState, FormData>(
    saveOnboardingPartner,
    {}
  );

  return (
    <form action={formAction} className="space-y-8">
      {next && <input type="hidden" name="next" value={next} />}

      <div className="space-y-3">
        <p className="text-sm font-medium">Type of organisation</p>
        <div className="space-y-2">
          {ORG_CATEGORIES.map(({ value, label, hint }) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 border border-border p-3 transition-colors hover:border-black has-[:checked]:border-black has-[:checked]:bg-muted/40"
            >
              <input
                type="radio"
                name="org_category"
                value={value}
                defaultChecked={defaultOrgCategory === value}
                required
                className="mt-0.5 accent-black"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground leading-snug">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <CombinedLocationPicker
        cities={cities}
        defaultCityId={defaultCityId}
        defaultFreeform={defaultCity}
        defaultCountry={defaultCountry}
        defaultRegionId={defaultRegionId}
        boards={boards}
        defaultLocalBoardId={defaultLocalBoardId}
        required
      />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-black px-4 py-2.5 text-sm text-white transition-opacity hover:opacity-80 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Go to your dashboard"}
      </button>
    </form>
  );
}
