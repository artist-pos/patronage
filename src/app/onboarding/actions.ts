"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isSelectableCountry } from "@/lib/constants/countries";

async function maybeSetVerifiedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string | null,
  bio: string | null,
  avatarUrl: string | null,
  disciplines: string[]
) {
  if (role !== "artist" && role !== "owner") return;

  // Check existing verified_at — avoid overwriting
  const { data: existing } = await supabase
    .from("profiles")
    .select("verified_at")
    .eq("id", userId)
    .maybeSingle();
  if (existing?.verified_at) return;

  if (!bio || !avatarUrl || disciplines.length === 0) return;

  const { count: artworkCount } = await supabase
    .from("artworks")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", userId);

  if ((artworkCount ?? 0) >= 3) {
    await supabase
      .from("profiles")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", userId);
  }
}

export interface ProfileFormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export async function upsertProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const full_name = (formData.get("full_name") as string)?.trim() || null;
  const bio = (formData.get("bio") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const country = (formData.get("country") as string) || null;
  const career_stage = (formData.get("career_stage") as string) || null;
  const mediumRaw = (formData.get("medium") as string) ?? "";
  const medium = mediumRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const disciplinesRaw = (formData.get("disciplines") as string) ?? "";
  const disciplines = disciplinesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const website_url = (formData.get("website_url") as string)?.trim() || null;
  const instagram_handle = (formData.get("instagram_handle") as string)?.trim().replace(/^@/, "") || null;

  // Demographic fields (opt-in, private)
  const yearOfBirthRaw = (formData.get("year_of_birth") as string)?.trim();
  let year_of_birth: number | null = null;
  if (yearOfBirthRaw) {
    const parsed = parseInt(yearOfBirthRaw, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(parsed) || parsed < 1920 || parsed > currentYear - 10) {
      return { fieldErrors: { year_of_birth: `Year must be between 1920 and ${currentYear - 10}.` } };
    }
    year_of_birth = parsed;
  }

  const identity_tags = formData.getAll("identity_tags") as string[];

  // Validate username
  if (!username) return { fieldErrors: { username: "Username is required." } };
  if (!/^[a-z0-9_-]{3,30}$/.test(username))
    return {
      fieldErrors: {
        username:
          "3–30 characters, lowercase letters, numbers, hyphens and underscores only.",
      },
    };

  // Check username uniqueness (excluding self)
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) return { fieldErrors: { username: "Username already taken." } };

  // Country is required — it drives the Artists directory tiers (NZ/AUS vs
  // International) and the country filter, so a blank leaves a profile
  // unplaceable. Validated here too: server actions are public endpoints.
  if (!country) return { fieldErrors: { country: "Country is required." } };
  if (!isSelectableCountry(country))
    return { fieldErrors: { country: "Select a valid country." } };

  const profileData: Record<string, unknown> = {
    id: user.id,
    username,
    full_name,
    bio,
    city,
    country: country || null,
    career_stage: career_stage || null,
    medium: medium.length > 0 ? medium : null,
    website_url,
    instagram_handle,
    year_of_birth,
    identity_tags,
  };
  // Only write disciplines when values are present — omitting it avoids
  // triggering the NOT NULL constraint for partners/patrons who don't
  // have a DisciplineInput in their form.
  if (disciplines.length > 0) {
    profileData.disciplines = disciplines;
  }

  // Commission fields — only written when the submitting form carried them
  // (guards against other forms that share this action resetting the flag).
  if (formData.get("has_commission_fields")) {
    profileData.open_for_commissions = formData.get("open_for_commissions") === "on";
    profileData.commission_info =
      (formData.get("commission_info") as string)?.trim() || null;
  }

  const { error } = await supabase.from("profiles").upsert(profileData);

  if (error) return { error: error.message };

  // Check if this artist has just become verified for the first time
  const { data: savedProfile } = await supabase
    .from("profiles")
    .select("role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  await maybeSetVerifiedAt(
    supabase,
    user.id,
    savedProfile?.role ?? null,
    bio,
    savedProfile?.avatar_url ?? null,
    disciplines
  );

  // Ensure artist/owner is in the subscriber list (safety net for flows that
  // bypass the role selection page, e.g. Google OAuth without a pre-selected role)
  const isArtistRole = savedProfile?.role === "artist" || savedProfile?.role === "owner";
  if (isArtistRole && user.email) {
    const email = user.email.toLowerCase().trim();
    await supabase
      .from("subscribers")
      .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
    // Also ensure digest flags are on if they were never set
    await supabase
      .from("profiles")
      .update({ marketing_subscription: true, weekly_digest: true })
      .eq("id", user.id)
      .eq("marketing_subscription", false);
  }

  redirect(`/${username}`);
}
