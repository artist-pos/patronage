import type { CountryEnum } from "@/types/database";

// What a member can pick for themselves on the profile form. Admins can set the
// full CountryEnum (incl. UK/US/EU) by hand in /admin/artists — anything
// outside NZ/AUS lands in the Artists page's International tier.
export const SELECTABLE_COUNTRIES: readonly CountryEnum[] = ["NZ", "AUS", "Global"];

// Every value the column accepts — used by admin tooling.
export const ALL_COUNTRIES: readonly CountryEnum[] = ["NZ", "AUS", "Global", "UK", "US", "EU"];

export const isSelectableCountry = (v: string | null | undefined): v is CountryEnum =>
  !!v && (SELECTABLE_COUNTRIES as readonly string[]).includes(v);
