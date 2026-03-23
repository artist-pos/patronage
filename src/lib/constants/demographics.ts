export const IDENTITY_TAGS = [
  'Māori',
  'Pasifika',
  'Asian',
  'Middle Eastern',
  'Latin American',
  'African',
  'European / Pākehā',
  'Indigenous (non-NZ)',
  'd/Deaf',
  'Disabled',
  'LGBTQIA+',
  'Refugee / migrant background',
] as const;

export type IdentityTag = typeof IDENTITY_TAGS[number];

export const AGE_BRACKETS = [
  { label: 'Under 25', min: null, max: 24 },
  { label: '25–34', min: 25, max: 34 },
  { label: '35–44', min: 35, max: 44 },
  { label: '45–54', min: 45, max: 54 },
  { label: '55+', min: 55, max: null },
] as const;

export const INCOME_CHANGE_OPTIONS = [
  'Increased',
  'Stayed the same',
  'Decreased',
  'Not applicable',
] as const;

export function getAgeBracket(yearOfBirth: number | null): string | null {
  if (!yearOfBirth) return null;
  const age = new Date().getFullYear() - yearOfBirth;
  const bracket = AGE_BRACKETS.find(
    (b) => (b.min === null || age >= b.min) && (b.max === null || age <= b.max)
  );
  return bracket?.label ?? null;
}
