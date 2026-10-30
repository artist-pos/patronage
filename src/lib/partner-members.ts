import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRow } from "@/app/partner/members/MembersManager";

/**
 * Everyone who can manage an organisation: its own login first, then the people
 * added as members. Emails live in auth.users, so they are looked up one by one.
 * Server only (uses the admin client).
 */
export async function loadOrgMembers(
  orgId: string,
  viewerId: string,
): Promise<{ orgName: string; members: MemberRow[] } | null> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("profiles")
    .select("id, role, full_name, username")
    .eq("id", orgId)
    .single();
  if (!org || org.role !== "partner") return null;

  const { data: rows } = await admin
    .from("partner_members")
    .select("user_id, created_at, profile:user_id(full_name, username)")
    .eq("partner_id", orgId)
    .order("created_at", { ascending: true });

  type Person = { full_name: string | null; username: string };
  type Row = { user_id: string; profile: Person | Person[] | null };

  const orgName = (org.full_name ?? org.username) as string;
  const people = [
    { userId: orgId, name: orgName, isPrimary: true },
    ...((rows ?? []) as unknown as Row[]).map((r) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return { userId: r.user_id, name: (p?.full_name ?? p?.username ?? "Member") as string, isPrimary: false };
    }),
  ];

  const members: MemberRow[] = await Promise.all(
    people.map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.userId);
      return { ...p, email: data?.user?.email ?? null, isYou: p.userId === viewerId };
    }),
  );

  return { orgName, members };
}
