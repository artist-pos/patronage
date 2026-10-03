"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSelectableCountry } from "@/lib/constants/countries";
import { isOrgCategory } from "@/lib/org-categories";
import { validLocalBoardId } from "@/lib/local-boards";
import { trackEvent } from "@/actions/trackEvent";

export interface PartnerStepState {
  error?: string;
}

export async function saveOnboardingPartner(
  _prev: PartnerStepState,
  formData: FormData
): Promise<PartnerStepState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const orgCategory = String(formData.get("org_category") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const cityId = String(formData.get("city_id") ?? "").trim();
  const regionId = String(formData.get("region_id") ?? "").trim();
  const boardSubmitted = formData.has("local_board_id");
  const localBoardId = boardSubmitted
    ? await validLocalBoardId(supabase, String(formData.get("local_board_id") ?? "").trim(), regionId)
    : null;
  const nextRaw = String(formData.get("next") ?? "");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/onboarding")
      ? nextRaw
      : null;

  if (!isOrgCategory(orgCategory))
    return { error: "Choose the type of organisation you represent." };
  if (!isSelectableCountry(country)) return { error: "Choose where you're based." };
  if (!city) return { error: "Add your city or town." };

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      org_category: orgCategory,
      country,
      city,
      city_id: cityId || null,
      region_id: regionId || null,
      ...(boardSubmitted ? { local_board_id: localBoardId } : {}),
    })
    .eq("id", user.id)
    .select("signup_source")
    .single();

  if (error) return { error: "Couldn't save that. Try again." };

  await trackEvent("signup_onboarding_completed", {
    source: updated?.signup_source ?? "none",
    role: "partner",
  });

  revalidatePath("/partner/dashboard");
  redirect(next ?? "/partner/dashboard?welcome=1");
}
