import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Only ever store a link to a real partner account. Server actions receive
 * whatever the browser sends, so a forged id (an artist, or a random uuid)
 * is dropped rather than written.
 */
export async function validPartnerProfileId(id: unknown): Promise<string | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("role", "partner")
    .maybeSingle();
  return data?.id ?? null;
}
