"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSelectableCountry } from "@/lib/constants/countries";
import { validLocalBoardId } from "@/lib/local-boards";
import { trackEvent } from "@/actions/trackEvent";
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
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const country = String(formData.get("country") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const cityId = String(formData.get("city_id") ?? "").trim();
  const regionId = String(formData.get("region_id") ?? "").trim();
  // Absent until migration 193 is live and the picker has boards to offer.
  const boardSubmitted = formData.has("local_board_id");
  const localBoardId = boardSubmitted
    ? await validLocalBoardId(supabase, String(formData.get("local_board_id") ?? "").trim(), regionId)
    : null;
  const disciplines = String(formData.get("disciplines") ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d): d is DisciplineEnum => VALID_DISCIPLINES.includes(d as DisciplineEnum));
  const medium = String(formData.get("medium") ?? "").trim();
  const weeklyDigest = formData.get("weekly_digest") === "on";
  // Where they were headed before signup interrupted them, carried through
  // the role step. Same-site paths only, and never back into onboarding.
  const nextRaw = String(formData.get("next") ?? "");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/onboarding")
      ? nextRaw
      : null;

  // Only present when signup didn't already collect a name.
  const nameSubmitted = formData.has("full_name");
  if (nameSubmitted && !fullName) return { error: "Add the name you want to show on your profile." };
  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    return { error: "Your handle needs 3–30 characters: lowercase letters, numbers, hyphens and underscores." };
  }
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();
  if (taken) return { error: "That handle is already taken. Try another." };
  if (!isSelectableCountry(country)) return { error: "Choose where you're based." };
  if (!city) return { error: "Add your city or town." };
  // Without a discipline the matching filter has nothing to run on and the
  // weekly scorer skips the account entirely, so this one cannot be optional.
  if (disciplines.length === 0) return { error: "Choose at least one discipline." };

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      ...(nameSubmitted ? { full_name: fullName } : {}),
      username,
      country,
      city,
      city_id: cityId || null,
      region_id: regionId || null,
      ...(boardSubmitted ? { local_board_id: localBoardId } : {}),
      disciplines,
      medium: medium ? medium.split(",").map((m) => m.trim()).filter(Boolean) : null,
      weekly_digest: weeklyDigest,
    })
    .eq("id", user.id)
    .select("signup_source")
    .single();

  if (error) return { error: "Couldn't save that. Try again." };

  // The artist's own "onboarding completed" moment — patrons/partners have
  // no profile step, so theirs already fired in /onboarding/role.
  await trackEvent("signup_onboarding_completed", { source: updated?.signup_source ?? "none", role: "artist" });

  revalidatePath("/opportunities");
  // Straight to the payoff. Not a bespoke summary screen: this is the real
  // For You page, so tapping a listing and coming back lands somewhere that
  // still works rather than on a consumed onboarding step.
  redirect(next ?? "/opportunities?tab=for-you&welcome=1");
}
