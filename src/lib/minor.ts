import { createAdminClient } from "@/lib/supabase/admin";

/** What a server action returns when messaging is closed to someone under 18. */
export const MESSAGING_UNAVAILABLE = "messaging_unavailable";

/**
 * True when any of these accounts belongs to someone under 18.
 *
 * Messaging is closed to under-18s in both directions: they cannot send, and
 * nobody can start a conversation with them. Reads through the admin client
 * because the answer must not depend on what the caller's session can see.
 * Server only.
 */
export async function anyMinor(ids: (string | null | undefined)[]): Promise<boolean> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").in("id", unique).eq("is_minor", true).limit(1);
  return (data ?? []).length > 0;
}
