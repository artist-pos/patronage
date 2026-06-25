"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const SUPPORT_WORKS_LIMIT_KEY = "support_works_limit";
export const SUPPORT_WORKS_MAX = 48;

export async function saveSupportWorksLimit(limit: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return { error: "Not authorised" };
  }

  const clamped = Math.max(1, Math.min(SUPPORT_WORKS_MAX, Math.round(limit)));

  // Admin client so RLS doesn't block the write (no user-facing write policy).
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert(
      { key: SUPPORT_WORKS_LIMIT_KEY, value: clamped, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) return { error: error.message };

  revalidatePath("/support");
  return {};
}
