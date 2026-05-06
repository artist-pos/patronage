import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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

// React.cache() deduplicates within a single server render pass — both
// StudioPageShell and studio/page.tsx call this with the same userId.
export const fetchCompletionProfile = cache(async (userId: string): Promise<CompletionProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("avatar_url, full_name, bio, disciplines, city")
    .eq("id", userId)
    .single();
  return data as CompletionProfile | null;
});
