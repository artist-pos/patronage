"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createProject } from "@/actions/projects";
import type { Grant } from "@/types/database";

export async function createGrantAction(input: {
  title: string;
  organiser?: string;
  amount_cents?: number | null;
  currency?: string;
  year?: number | null;
  notes?: string;
  opportunity_id?: string | null;
}): Promise<{ grant?: Grant; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("grants")
    .insert({
      profile_id: user.id,
      title: input.title.trim(),
      organiser: input.organiser?.trim() || null,
      amount_cents: input.amount_cents ?? null,
      currency: input.currency ?? "NZD",
      year: input.year ?? null,
      notes: input.notes?.trim() || null,
      opportunity_id: input.opportunity_id ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/studio");
  revalidatePath("/settings");
  return { grant: data as Grant };
}

export async function deleteGrantAction(grantId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("grants")
    .delete()
    .eq("id", grantId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/studio");
  revalidatePath("/settings");
  return {};
}

export async function startProjectFromGrantAction(
  grantId: string,
  grantTitle: string,
): Promise<{ projectId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify the grant belongs to this user
  const { data: grant } = await supabase
    .from("grants")
    .select("id, project_id")
    .eq("id", grantId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!grant) return { error: "Grant not found" };
  if ((grant as { project_id: string | null }).project_id) {
    return { projectId: (grant as { project_id: string }).project_id };
  }

  let projectId: string;
  try {
    projectId = await createProject(grantTitle, `Project for grant: ${grantTitle}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create project" };
  }

  const { error } = await supabase
    .from("grants")
    .update({ project_id: projectId })
    .eq("id", grantId);

  if (error) return { error: error.message };

  revalidatePath("/studio");
  return { projectId };
}
