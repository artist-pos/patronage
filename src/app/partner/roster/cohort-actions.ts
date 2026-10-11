"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCohortCode } from "@/lib/cohorts";

/**
 * Cohorts: a named group under an organisation with its own join link.
 * Any organisation may keep them, roster or not. Checked inside every action,
 * since a server action is a public endpoint.
 */
async function requireOrg(): Promise<{ orgId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data } = await createAdminClient().from("profiles").select("role").eq("id", user.id).single();
  if ((data as { role: string } | null)?.role !== "partner") {
    return { error: "Only organisations can keep cohorts." };
  }
  return { orgId: user.id };
}

export async function createCohort(input: { name: string; year?: number | null }): Promise<{ error?: string }> {
  const { orgId, error } = await requireOrg();
  if (!orgId) return { error };

  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Give the cohort a name." };
  const year = input.year && input.year >= 1900 && input.year <= 2100 ? Math.trunc(input.year) : null;

  const admin = createAdminClient();
  // A collision on a 7-character code is vanishingly unlikely; retry anyway
  // rather than surface a unique-violation to a teacher.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: insertError } = await admin
      .from("org_cohorts")
      .insert({ org_profile_id: orgId, name, year, code: generateCohortCode() });
    if (!insertError) {
      revalidatePath("/partner/roster");
      return {};
    }
    if (insertError.code !== "23505") return { error: "Could not create the cohort. Try again." };
  }
  return { error: "Could not create the cohort. Try again." };
}

export async function setCohortActive(cohortId: string, active: boolean): Promise<{ error?: string }> {
  const { orgId, error } = await requireOrg();
  if (!orgId) return { error };

  const { error: updateError } = await createAdminClient()
    .from("org_cohorts")
    .update({ is_active: active })
    .eq("id", cohortId)
    .eq("org_profile_id", orgId);
  if (updateError) return { error: "Could not update the cohort." };

  revalidatePath("/partner/roster");
  return {};
}
