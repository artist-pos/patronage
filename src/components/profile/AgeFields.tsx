"use client";

import { useState } from "react";
import { ageBand } from "@/lib/age";

interface Props {
  /** Asked of everyone who arrives through a school invitation. */
  required?: boolean;
  defaultYear?: number | null;
  defaultConfirmed?: boolean;
  error?: string;
}

/**
 * Year of birth, plus the one question the year cannot answer.
 *
 * In the year someone turns 18 they are 17 or 18 depending on the month, so
 * that year (and only that year) asks "Have you turned 18?". Anyone under 18
 * is told how their profile is shown. Mirrors the rule in lib/age.ts.
 */
export function AgeFields({ required = false, defaultYear = null, defaultConfirmed = false, error }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(defaultYear ? String(defaultYear) : "");
  const band = ageBand(parseInt(year, 10) || null);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="year_of_birth" className="text-sm font-medium">
          Year of birth{" "}
          {!required && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
        </label>
        <input
          id="year_of_birth"
          name="year_of_birth"
          type="number"
          inputMode="numeric"
          min={1920}
          max={currentYear - 10}
          required={required}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder={`e.g. ${currentYear - 17}`}
          className="w-full border border-black bg-background px-3 py-2 text-base focus-visible:outline-none sm:text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">
          Never shown on your profile. It decides how your profile is listed.
        </p>
      </div>

      {band === "ask" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Have you turned 18?</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="age_confirmed_adult" value="yes" defaultChecked={defaultConfirmed} className="border-black" />
            Yes
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="age_confirmed_adult" value="no" defaultChecked={!defaultConfirmed} className="border-black" />
            Not yet
          </label>
        </fieldset>
      )}

      {(band === "minor" || band === "ask") && (
        <p className="border border-border p-3 text-sm text-muted-foreground">
          Under 18? Your profile stays off search engines and out of Patronage&rsquo;s lists and directories, and
          messaging is switched off until you turn 18. Anyone you send your link to can still open your profile.
        </p>
      )}
    </div>
  );
}
