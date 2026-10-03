"use client";

import { useActionState } from "react";
import { CombinedLocationPicker } from "@/components/profile/CombinedLocationPicker";
import { MediumInput } from "@/components/profile/MediumInput";
import { saveOnboardingPatron, type PatronStepState } from "./actions";
import type { CityWithRegion, LocalBoard } from "@/types/database";

interface Props {
  cities: CityWithRegion[];
  boards: LocalBoard[];
  defaultLocalBoardId: string | null;
  defaultCountry: string;
  defaultCity: string;
  defaultCityId: string | null;
  defaultRegionId: string | null;
  defaultMedium: string[];
  next: string | null;
}

export function PatronStepForm({
  cities,
  boards,
  defaultLocalBoardId,
  defaultCountry,
  defaultCity,
  defaultCityId,
  defaultRegionId,
  defaultMedium,
  next,
}: Props) {
  const [state, formAction, pending] = useActionState<PatronStepState, FormData>(
    saveOnboardingPatron,
    {}
  );

  return (
    <form action={formAction} className="space-y-8">
      {next && <input type="hidden" name="next" value={next} />}

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

      <div className="space-y-2">
        <p className="text-sm font-medium">What do you love?</p>
        <p className="text-xs text-muted-foreground">
          Optional — helps us show you artists whose work matches your taste.
        </p>
        <MediumInput defaultValue={defaultMedium} />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-black px-4 py-2.5 text-sm text-white transition-opacity hover:opacity-80 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Discover artists"}
      </button>
    </form>
  );
}
