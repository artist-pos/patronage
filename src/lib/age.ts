/**
 * Who counts as a minor on Patronage.
 *
 * Only a year of birth is collected, so the year someone turns 18 is
 * ambiguous: they are 17 or 18 depending on the month. That one year is
 * resolved by asking ("Have you turned 18?") rather than guessing.
 *
 * Mirrors profile_is_minor() in migration 202. Keep the two in step.
 */
export type AgeBand =
  | "unknown" // no year given
  | "minor" // under 18 for certain
  | "ask" // 17 or 18: the person says which
  | "adult"; // 18 or over for certain

export function ageBand(yearOfBirth: number | null | undefined, now = new Date()): AgeBand {
  if (!yearOfBirth) return "unknown";
  const diff = now.getFullYear() - yearOfBirth;
  if (diff <= 17) return "minor";
  if (diff === 18) return "ask";
  return "adult";
}

/** Whether the profile belongs off public lists and out of search. */
export function isMinor(
  yearOfBirth: number | null | undefined,
  confirmedAdult: boolean,
  now = new Date()
): boolean {
  const band = ageBand(yearOfBirth, now);
  return band === "minor" || (band === "ask" && !confirmedAdult);
}

/**
 * Reads the year of birth and the "have you turned 18" answer from a form.
 * The answer only counts in the one year it applies to: an under-18 cannot
 * mark themselves an adult, and an adult has no need to.
 */
export function parseAgeFields(
  formData: FormData,
  now = new Date()
): { yearOfBirth: number | null; confirmedAdult: boolean; error?: string } {
  const raw = (formData.get("year_of_birth") as string)?.trim();
  const currentYear = now.getFullYear();
  if (!raw) return { yearOfBirth: null, confirmedAdult: false };

  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1920 || parsed > currentYear - 10) {
    return {
      yearOfBirth: null,
      confirmedAdult: false,
      error: `Year must be between 1920 and ${currentYear - 10}.`,
    };
  }

  const answered = formData.get("age_confirmed_adult") === "yes";
  return {
    yearOfBirth: parsed,
    confirmedAdult: ageBand(parsed, now) === "ask" && answered,
  };
}
