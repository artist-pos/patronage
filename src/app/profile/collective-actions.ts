"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createCollective(data: {
  name: string;
  description?: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.name.trim()) return { error: "Name is required" };

  const { data: collective, error: insertErr } = await supabase
    .from("collectives")
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !collective) return { error: insertErr?.message ?? "Failed to create collective" };

  // Add creator as admin member
  await supabase.from("collective_members").insert({
    collective_id: collective.id,
    user_id: user.id,
    role: "admin",
  });

  revalidatePath("/profile");
  return { id: collective.id };
}

export async function leaveCollective(collectiveId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collective_members")
    .delete()
    .eq("collective_id", collectiveId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return {};
}

export async function deleteCollective(collectiveId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collectives")
    .delete()
    .eq("id", collectiveId)
    .eq("created_by", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return {};
}
