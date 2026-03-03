"use server";

import { createClient } from "@/lib/supabase/server";

export async function postOpportunity(formData: {
  title: string;
  type: string;
  budget: string;
  description: string;
  deadline: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("opportunities").insert({
    profile_id: user.id,
    title: formData.title.trim().slice(0, 140),
    organiser: "", // not required for profile opportunities
    type: formData.type,
    country: "Global",
    description: formData.description.trim().slice(0, 500) || null,
    caption: formData.budget.trim() || null,
    deadline: formData.deadline || null,
    is_active: true,
  });

  if (error) return { error: error.message };
  return {};
}

export async function deleteOpportunity(oppId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", oppId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  return {};
}
