export type CountryEnum = "NZ" | "AUS" | "Global";
export type OppTypeEnum =
  | "Grant"
  | "Residency"
  | "Commission"
  | "Open Call"
  | "Prize"
  | "Display";

export interface Opportunity {
  id: string;
  title: string;
  organiser: string;
  description: string | null;
  type: OppTypeEnum;
  country: CountryEnum;
  deadline: string | null; // ISO date string e.g. "2026-06-30"
  url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OpportunityFilters {
  type?: OppTypeEnum;
  country?: CountryEnum;
}
