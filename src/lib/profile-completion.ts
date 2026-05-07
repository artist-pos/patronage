export interface CompletionField {
  key: string;
  label: string;
  href: string;
}

// Use plain string[] so this is compatible with both DisciplineEnum[] (Profile)
// and untyped Supabase query results.
export interface CompletionProfile {
  avatar_url: string | null;
  full_name: string | null;
  bio: string | null;
  disciplines: string[] | null;
  city: string | null;
}

const REQUIRED_FIELDS: CompletionField[] = [
  { key: "avatar",      label: "profile photo", href: "/studio?section=profile" },
  { key: "full_name",   label: "display name",  href: "/studio?section=profile" },
  { key: "bio",         label: "bio",           href: "/studio?section=profile" },
  { key: "disciplines", label: "discipline",    href: "/studio?section=profile" },
  { key: "city",        label: "city",          href: "/studio?section=profile" },
];

export function getMissingFields(profile: CompletionProfile): CompletionField[] {
  return REQUIRED_FIELDS.filter(({ key }) => {
    if (key === "avatar")      return !profile.avatar_url;
    if (key === "full_name")   return !profile.full_name?.trim();
    if (key === "bio")         return !profile.bio?.trim();
    if (key === "disciplines") return !profile.disciplines?.length;
    if (key === "city")        return !profile.city?.trim();
    return false;
  });
}

export function getCompletionPercent(profile: CompletionProfile): number {
  const missing = getMissingFields(profile).length;
  return Math.round(((REQUIRED_FIELDS.length - missing) / REQUIRED_FIELDS.length) * 100);
}

export function isProfileComplete(profile: CompletionProfile): boolean {
  return getMissingFields(profile).length === 0;
}

