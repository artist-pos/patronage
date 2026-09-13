"use client";

import { useActionState } from "react";
import { LocationPicker } from "@/components/profile/LocationPicker";
import { DisciplineInput } from "@/components/profile/DisciplineInput";
import { SELECTABLE_COUNTRIES } from "@/lib/constants/countries";
import { saveOnboardingProfile, type ProfileStepState } from "./actions";
import type { CityWithRegion, DisciplineEnum } from "@/types/database";

interface Props {
  cities: CityWithRegion[];
  /** Seeded from the listing or invitation they arrived through, so for most
   *  people this screen is a glance and a Continue rather than typing. */
  defaultName: string;
  defaultCountry: string;
  defaultCity: string;
  defaultCityId: string | null;
  defaultRegionId: string | null;
  defaultDisciplines: DisciplineEnum[];
}

export function ProfileStepForm({
  cities,
  defaultName,
  defaultCountry,
  defaultCity,
  defaultCityId,
  defaultRegionId,
  defaultDisciplines,
}: Props) {
  const [state, formAction, pending] = useActionState<ProfileStepState, FormData>(
    saveOnboardingProfile,
    {}
  );

  return (
    <form action={formAction} className="space-y-8">
      <div className="space-y-2">
        <label htmlFor="full_name" className="text-sm font-medium">
          Your name
        </label>
        <input
          id="full_name"
          name="full_name"
          defaultValue={defaultName}
          required
          autoComplete="name"
          placeholder="The name you show on your profile"
          className="w-full border border-black bg-background px-3 py-2 text-base focus-visible:outline-none sm:text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="country" className="text-sm font-medium">
          Where you&rsquo;re based
        </label>
        <select
          id="country"
          name="country"
          defaultValue={defaultCountry}
          required
          className="w-full border border-black bg-background px-3 py-2 text-base focus-visible:outline-none sm:text-sm"
        >
          <option value="">– Select –</option>
          {SELECTABLE_COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <LocationPicker
        cities={cities}
        defaultCityId={defaultCityId}
        defaultFreeform={defaultCity}
        defaultRegionId={defaultRegionId}
        required
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">Your disciplines</p>
        <p className="text-xs text-muted-foreground">
          Pick everything that applies. This is what we match opportunities against.
        </p>
        <DisciplineInput defaultValue={defaultDisciplines} />
      </div>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          name="weekly_digest"
          defaultChecked
          className="mt-0.5 h-4 w-4 accent-black"
        />
        <span className="text-sm">
          Email me new opportunities weekly
          <span className="block text-xs text-muted-foreground">
            One email, the listings closing soonest. Unsubscribe any time.
          </span>
        </span>
      </label>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-black px-4 py-2.5 text-sm text-white transition-opacity hover:opacity-80 disabled:opacity-60"
      >
        {pending ? "Saving…" : "See my opportunities"}
      </button>
    </form>
  );
}
