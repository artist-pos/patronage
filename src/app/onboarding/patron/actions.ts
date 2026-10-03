"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSelectableCountry } from "@/lib/constants/countries";
import { validLocalBoardId } from "@/lib/local-boards";
import { trackEvent } from "@/actions/trackEvent";

export interface PatronStepState {
  error?: string;
}

export async function saveOnboardingPatron(
  _prev: PatronStepState,
  formData: FormData
): Promise<PatronStepState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const country = String(formData.get("country") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const cityId = String(formData.get("city_id") ?? "").trim();
  const regionId = String(formData.get("region_id") ?? "").trim();
  const boardSubmitted = formData.has("local_board_id");
  const localBoardId = boardSubmitted
    ? await validLocalBoardId(supabase, String(formData.get("local_board_id") ?? "").trim(), regionId)
    : null;
  const mediumRaw = String(formData.get("medium") ?? "").trim();
  const medium = mediumRaw ? mediumRaw.split(",").map((m) => m.trim()).filter(Boolean) : null;
  const nextRaw = String(formData.get("next") ?? "");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/onboarding")
      ? nextRaw
      : null;

  if (!isSelectableCountry(country)) return { error: "Choose where you're based." };
  if (!city) return { error: "Add your city or town." };

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      country,
      city,
      city_id: cityId || null,
      region_id: regionId || null,
      ...(boardSubmitted ? { local_board_id: localBoardId } : {}),
      ...(medium ? { medium } : {}),
    })
    .eq("id", user.id)
    .select("signup_source")
    .single();

  if (error) return { error: "Couldn't save that. Try again." };

  await trackEvent("signup_onboarding_completed", {
    source: updated?.signup_source ?? "none",
    role: "patron",
  });

  revalidatePath("/dashboard");
  redirect(next ?? "/dashboard?welcome=1");
}
