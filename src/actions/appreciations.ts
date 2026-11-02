"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Appreciate (or un-appreciate) a studio update (225). Private: only the
 * artist ever hears about it, as a count in their Monday email.
 */
export async function setAppreciation(
  updateId: string,
  appreciated: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (appreciated) {
    const { error } = await supabase
      .from("update_appreciations")
      .upsert({ update_id: updateId, user_id: user.id }, { onConflict: "update_id,user_id", ignoreDuplicates: true });
    if (error) return { error: "Couldn't save that." };
  } else {
    const { error } = await supabase
      .from("update_appreciations")
      .delete()
      .eq("update_id", updateId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }
  return {};
}

/** Which of these updates the viewer has appreciated — only their own rows. */
export async function getMyAppreciations(updateIds: string[]): Promise<string[]> {
  if (updateIds.length === 0) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("update_appreciations")
    .select("update_id")
    .eq("user_id", user.id)
    .in("update_id", updateIds.slice(0, 200));
  return (data ?? []).map((r) => r.update_id);
}
