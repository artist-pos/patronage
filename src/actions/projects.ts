"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProject(title: string, description: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({ artist_id: user.id, title: title.trim(), description: description?.trim() || null })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/profile/edit");
  return data.id as string;
}

export async function assignUpdateToProject(updateId: string, projectId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_updates")
    .update({ project_id: projectId })
    .eq("id", updateId);

  if (error) throw new Error(error.message);
  revalidatePath("/profile/edit");
}
