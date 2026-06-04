"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProject(
  title: string,
  description: string | null,
  artworkId?: string | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      artist_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      artwork_id: artworkId ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/feed");
  return data.id as string;
}

export async function linkProjectToArtwork(projectId: string, artworkId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("projects")
    .update({ artwork_id: artworkId })
    .eq("id", projectId)
    .eq("artist_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/studio/works/${artworkId}`);
}

export async function unlinkProjectFromArtwork(projectId: string, artworkId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("projects")
    .update({ artwork_id: null })
    .eq("id", projectId)
    .eq("artist_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/studio/works/${artworkId}`);
}

export async function updateProject(
  projectId: string,
  title: string,
  description: string | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("projects")
    .update({ title: title.trim(), description: description?.trim() || null })
    .eq("id", projectId)
    .eq("artist_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/threads/${projectId}`);
  return {};
}

export async function assignUpdateToProject(updateId: string, projectId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_updates")
    .update({ project_id: projectId })
    .eq("id", updateId);

  if (error) throw new Error(error.message);
}
