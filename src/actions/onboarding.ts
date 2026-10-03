"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSelectableCountry } from "@/lib/constants/countries";
import { isOrgCategory } from "@/lib/org-categories";
import { validLocalBoardId } from "@/lib/local-boards";
import { sendWelcomeDigest } from "@/lib/digest-send";
import { issueEmailVerification } from "@/lib/email-verification";
import { sendWelcomeDm } from "@/lib/welcome-dm";
import { SIGNUP_CONTEXT_COOKIE, decodeSignupContext } from "@/lib/signup-context";
import { trackEvent } from "@/actions/trackEvent";
import type { DisciplineEnum } from "@/types/database";

const VALID_ROLES = ["artist", "patron", "partner"] as const;
type Role = (typeof VALID_ROLES)[number];

const VALID_DISCIPLINES = [
  "visual_art", "music", "photography", "film", "writing",
  "poetry", "dance", "performance", "craft", "other",
] as const;

export interface OnboardingResult {
  error?: string;
  destination?: string;
}

/**
 * Unified onboarding action used by the modal flow.
 *
 * Handles two cases:
 * - New user (no profile row yet): creates full profile from scratch.
 * - Returning incomplete user (profile exists, missing fields): updates only
 *   the fields that onboarding is responsible for.
 *
 * Returns { destination } on success instead of redirecting, so the modal can
 * navigate client-side without a full page reload.
 */
export async function completeOnboarding(
  _prev: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const role = String(formData.get("role") ?? "").trim() as Role;
  if (!VALID_ROLES.includes(role)) return { error: "Choose how you'll use Patronage." };

  const isArtist = role === "artist";
  const isOAuth = user.app_metadata?.provider === "google";

  // Determine whether we're creating or updating
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username, role, signup_source, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // For existing profiles, guard against a role mismatch (form manipulation)
  if (existing?.role && existing.role !== role) {
    return { error: "Role mismatch." };
  }

  // --- Shared field parsing ---

  const country = String(formData.get("country") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const cityId = String(formData.get("city_id") ?? "").trim();
  const regionId = String(formData.get("region_id") ?? "").trim();
  const boardSubmitted = formData.has("local_board_id");
  const localBoardId = boardSubmitted
    ? await validLocalBoardId(supabase, String(formData.get("local_board_id") ?? "").trim(), regionId)
    : null;

  if (!isSelectableCountry(country)) return { error: "Choose where you're based." };
  if (!city) return { error: "Add your city or town." };

  const locationFields = {
    country,
    city,
    city_id: cityId || null,
    region_id: regionId || null,
    ...(boardSubmitted ? { local_board_id: localBoardId } : {}),
  };

  // Artist disciplines
  let disciplines: DisciplineEnum[] = [];
  let medium: string[] | null = null;
  if (isArtist) {
    disciplines = String(formData.get("disciplines") ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter((d): d is DisciplineEnum => (VALID_DISCIPLINES as readonly string[]).includes(d));
    if (disciplines.length === 0) return { error: "Choose at least one discipline." };
    const mediumRaw = String(formData.get("medium") ?? "").trim();
    medium = mediumRaw ? mediumRaw.split(",").map((m) => m.trim()).filter(Boolean) : null;
  } else {
    // Patron taste (optional)
    const mediumRaw = String(formData.get("medium") ?? "").trim();
    medium = mediumRaw ? mediumRaw.split(",").map((m) => m.trim()).filter(Boolean) : null;
  }

  // Partner org category
  const orgCategoryRaw = role === "partner" ? String(formData.get("org_category") ?? "").trim() : null;
  if (role === "partner" && !isOrgCategory(orgCategoryRaw)) {
    return { error: "Choose the type of organisation you represent." };
  }
  const orgCategory = orgCategoryRaw && isOrgCategory(orgCategoryRaw) ? orgCategoryRaw : null;

  // --- New profile (create) ---

  if (!existing) {
    const cookieStore = await cookies();
    const signupCtx = decodeSignupContext(cookieStore.get(SIGNUP_CONTEXT_COOKIE)?.value);

    const rawMetaName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const metaName = typeof rawMetaName === "string" ? rawMetaName.trim().slice(0, 120) : "";

    const nameHandle = metaName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    const emailHandle = user.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
    const candidate = nameHandle.length >= 3 ? nameHandle : emailHandle || "";
    const baseUsername = candidate.length >= 3 ? candidate : `${candidate}${user.id.replace(/-/g, "").slice(0, 6)}`;

    const profileData = {
      id: user.id,
      username: baseUsername,
      email: user.email?.toLowerCase().trim() ?? null,
      role,
      is_active: true,
      ...(isOAuth && { email_verified_at: new Date().toISOString() }),
      marketing_subscription: true,
      weekly_digest: true,
      ...locationFields,
      ...(isArtist && disciplines.length > 0 && { disciplines }),
      ...(isArtist && metaName ? { full_name: metaName } : {}),
      ...(medium ? { medium } : {}),
      ...(orgCategory ? { org_category: orgCategory } : {}),
      ...(signupCtx && {
        signup_source: signupCtx.source,
        ...(signupCtx.opportunityId && { signup_source_opportunity_id: signupCtx.opportunityId }),
        ...(signupCtx.ref && { signup_source_ref: signupCtx.ref }),
      }),
      ...(isArtist && signupCtx?.invitedByOrgId && { invited_by_org_id: signupCtx.invitedByOrgId }),
      ...(signupCtx?.regionId && !regionId && { region_id: signupCtx.regionId }),
    };

    let { error: upsertError } = await supabase
      .from("profiles")
      .upsert(profileData, { onConflict: "id", ignoreDuplicates: false });

    if (upsertError?.code === "23505") {
      ({ error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          { ...profileData, username: `${baseUsername}_${user.id.replace(/-/g, "").slice(0, 6)}` },
          { onConflict: "id", ignoreDuplicates: false }
        ));
    }

    if (upsertError) {
      console.error("completeOnboarding: upsert failed", { userId: user.id, role, error: upsertError });
      return { error: "Couldn't save that. Try again." };
    }

    try { cookieStore.delete(SIGNUP_CONTEXT_COOKIE); } catch {}

    await Promise.all([
      trackEvent("signup_account_created", { source: signupCtx?.source ?? "none", role }),
      trackEvent("signup_onboarding_completed", { source: signupCtx?.source ?? "none", role }),
    ]);

    if (isArtist && signupCtx?.inviteToken) {
      const admin = createAdminClient();
      await admin
        .from("artist_invitations")
        .update({ status: "joined", joined_at: new Date().toISOString(), joined_profile_id: user.id })
        .eq("token", signupCtx.inviteToken);
    }

    after(async () => {
      if (isArtist && isOAuth && user.email) {
        await sendWelcomeDigest(user.email.toLowerCase().trim()).catch(console.error);
      }
      if (!isOAuth) await issueEmailVerification(user.id).catch(console.error);
      await sendWelcomeDm(user.id, role).catch(console.error);
    });

  } else {
    // --- Existing profile (update missing fields) ---

    const rawMetaName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const metaName = typeof rawMetaName === "string" ? rawMetaName.trim().slice(0, 120) : "";

    const updates: Record<string, unknown> = {
      ...locationFields,
      ...(isArtist && disciplines.length > 0 && { disciplines }),
      ...(medium ? { medium } : {}),
      ...(orgCategory ? { org_category: orgCategory } : {}),
      // Fill full_name from metadata if the profile doesn't have one yet
      ...(isArtist && !existing.full_name && metaName ? { full_name: metaName } : {}),
    };

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select("signup_source")
      .single();

    if (error) {
      console.error("completeOnboarding: update failed", { userId: user.id, role, error });
      return { error: "Couldn't save that. Try again." };
    }

    await trackEvent("signup_onboarding_completed", {
      source: updated?.signup_source ?? existing.signup_source ?? "none",
      role,
    });
  }

  if (isArtist) revalidatePath("/");

  const destination = isArtist
    ? "/opportunities?tab=for-you&welcome=1"
    : role === "patron"
      ? "/dashboard?welcome=1"
      : "/partner/dashboard?welcome=1";

  return { destination };
}
