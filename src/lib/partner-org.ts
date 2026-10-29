import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerUser } from "@/lib/supabase/get-server-user";

/**
 * A partner organisation is one profiles row. Besides its own login, other
 * people can be added through partner_members and manage it with full owner
 * access (migration 223). These helpers answer "which organisation is this
 * person managing right now, and may they?".
 */
export const ACTING_ORG_COOKIE = "patronage_acting_org";

/** Organisations the user belongs to as an added member (not their own profile). */
export async function getMemberOrgIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("partner_members")
    .select("partner_id")
    .eq("user_id", userId);
  return (data ?? []).map((r: { partner_id: string }) => r.partner_id);
}

/** True when the user is the organisation's own login or an added member. */
export async function isOrgMember(
  supabase: SupabaseClient,
  userId: string,
  orgId: string | null | undefined,
): Promise<boolean> {
  if (!orgId) return false;
  if (orgId === userId) return true;
  const { count } = await supabase
    .from("partner_members")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", orgId)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

/**
 * Which profile a form should write to. A form that edits an organisation
 * names it explicitly (a hidden `org_id`); anything else writes to the user's
 * own profile. This never reads the switcher cookie, so editing your personal
 * profile can't end up on an organisation by accident. Null means the user
 * named an organisation they don't belong to.
 */
export async function resolveEditTarget(
  supabase: SupabaseClient,
  userId: string,
  requested: FormDataEntryValue | null | undefined,
): Promise<string | null> {
  const wanted = typeof requested === "string" ? requested.trim() : "";
  if (!wanted || wanted === userId) return userId;
  return (await isOrgMember(supabase, userId, wanted)) ? wanted : null;
}

/**
 * The organisation the signed-in user is managing. Honours the switcher cookie
 * only when it names an organisation they belong to. Otherwise a partner login
 * manages itself, and anyone else manages their first organisation. With no
 * memberships at all it is simply the user's own id, so single-login
 * organisations behave exactly as before.
 */
export async function getActingOrg(): Promise<{
  supabase: SupabaseClient;
  user: { id: string; email?: string | null } | null;
  orgId: string | null;
  memberOrgIds: string[];
}> {
  const { supabase, user } = await getServerUser();
  if (!user) return { supabase, user: null, orgId: null, memberOrgIds: [] };

  const memberOrgIds = await getMemberOrgIds(supabase, user.id);
  if (memberOrgIds.length === 0) return { supabase, user, orgId: user.id, memberOrgIds };

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTING_ORG_COOKIE)?.value;
  if (wanted && (wanted === user.id || memberOrgIds.includes(wanted))) {
    return { supabase, user, orgId: wanted, memberOrgIds };
  }

  const { data: own } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const orgId = own?.role === "partner" ? user.id : memberOrgIds[0];
  return { supabase, user, orgId, memberOrgIds };
}
