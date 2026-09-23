"use client";

import { useActionState } from "react";
import { LocationPicker } from "@/components/profile/LocationPicker";
import { DisciplineInput } from "@/components/profile/DisciplineInput";
import { SELECTABLE_COUNTRIES } from "@/lib/constants/countries";
import { saveOnboardingProfile, type ProfileStepState } from "./actions";
import type { CityWithRegion, DisciplineEnum, LocalBoard } from "@/types/database";

interface Props {
  cities: CityWithRegion[];
  boards: LocalBoard[];
  defaultLocalBoardId: string | null;
  /** Seeded from the listing or invitation they arrived through, so for most
   *  people this screen is a glance and a Continue rather than typing. */
  defaultName: string;
  defaultUsername: string;
  defaultCountry: string;
  defaultCity: string;
  defaultCityId: string | null;
  defaultRegionId: string | null;
  defaultDisciplines: DisciplineEnum[];
  next: string | null;
}

export function ProfileStepForm({
  cities,
  boards,
  defaultLocalBoardId,
  defaultName,
  defaultUsername,
  defaultCountry,
  defaultCity,
  defaultCityId,
  defaultRegionId,
  defaultDisciplines,
  next,
}: Props) {
  const [state, formAction, pending] = useActionState<ProfileStepState, FormData>(
    saveOnboardingProfile,
    {}
  );

  return (
    <form action={formAction} className="space-y-8">
      {next && <input type="hidden" name="next" value={next} />}
      {/* Signup already collects a name; this only appears for the accounts
          that arrive without one (e.g. a Google profile with no name). */}
      {!defaultName.trim() && (
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
      )}

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">
          Your handle
        </label>
        <div className="flex items-center border border-black bg-background focus-within:ring-1 focus-within:ring-black">
          <span className="select-none pl-3 text-base text-muted-foreground sm:text-sm">patronage.nz/</span>
          <input
            id="username"
            name="username"
            defaultValue={defaultUsername}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9_\-]{3,30}"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            title="3–30 characters: lowercase letters, numbers, hyphens and underscores"
            className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-base focus-visible:outline-none sm:text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your public profile link. You can change it later.
        </p>
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
        boards={boards}
        defaultLocalBoardId={defaultLocalBoardId}
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
