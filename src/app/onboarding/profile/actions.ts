"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSelectableCountry } from "@/lib/constants/countries";
import type { DisciplineEnum } from "@/types/database";

const VALID_DISCIPLINES: DisciplineEnum[] = [
  "visual_art", "music", "photography", "film", "writing",
  "poetry", "dance", "performance", "craft", "other",
];

export interface ProfileStepState {
  error?: string;
}

/**
 * The only write the onboarding profile step makes.
 *
 * Server Actions are public endpoints, so this authenticates itself and only
 * ever writes the session's own row. Four fields, because four is what the
 * next screen needs to be worth looking at: a name to greet them by, and the
 * country and disciplines the matching filter runs on.
 */
export async function saveOnboardingProfile(
  _prev: ProfileStepState,
  formData: FormData
): Promise<ProfileStepState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const cityId = String(formData.get("city_id") ?? "").trim();
  const regionId = String(formData.get("region_id") ?? "").trim();
  const disciplines = String(formData.get("disciplines") ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d): d is DisciplineEnum => VALID_DISCIPLINES.includes(d as DisciplineEnum));
  const medium = String(formData.get("medium") ?? "").trim();
  const weeklyDigest = formData.get("weekly_digest") === "on";

  if (!fullName) return { error: "Add the name you want to show on your profile." };
  if (!isSelectableCountry(country)) return { error: "Choose where you're based." };
  if (!city) return { error: "Add your city or town." };
  // Without a discipline the matching filter has nothing to run on and the
  // weekly scorer skips the account entirely, so this one cannot be optional.
  if (disciplines.length === 0) return { error: "Choose at least one discipline." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      country,
      city,
      city_id: cityId || null,
      region_id: regionId || null,
      disciplines,
      medium: medium ? medium.split(",").map((m) => m.trim()).filter(Boolean) : null,
      weekly_digest: weeklyDigest,
    })
    .eq("id", user.id);

  if (error) return { error: "Couldn't save that. Try again." };

  revalidatePath("/opportunities");
  // Straight to the payoff. Not a bespoke summary screen: this is the real
  // For You page, so tapping a listing and coming back lands somewhere that
  // still works rather than on a consumed onboarding step.
  redirect("/opportunities?tab=for-you&welcome=1");
}
