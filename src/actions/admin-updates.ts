"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function adminUpdateStudioUpdate(
  id: string,
  data: { title: string | null; tldr: string | null }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return { error: "Unauthorised" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("project_updates")
    .update({ title: data.title || null, tldr: data.tldr || null })
    .eq("id", id);

  if (error) return { error: error.message };
  return {};
}
