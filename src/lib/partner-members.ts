import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRow } from "@/app/partner/members/MembersManager";

export interface PublicOwner {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  medium: string[] | null;
}

/**
 * The people shown as running an organisation on its public page. Only members
 * with a real, active, adult profile and a name: guest accounts made from an
 * email address have neither, so they are never named. The organisation's own
 * login is the page itself, so it is not repeated here.
 */
export async function getPublicOrgOwners(orgId: string): Promise<PublicOwner[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_members")
    .select("created_at, profile:user_id!inner(id, username, full_name, avatar_url, medium, role, is_active, is_minor)")
    .eq("partner_id", orgId)
    .order("created_at", { ascending: true });

  type P = {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    medium: string[] | null;
    role: string;
    is_active: boolean | null;
    is_minor: boolean | null;
  };
  return ((data ?? []) as unknown as Array<{ profile: P | P[] | null }>)
    .map((r) => (Array.isArray(r.profile) ? r.profile[0] : r.profile))
    .filter(
      (p): p is P =>
        !!p && !!p.full_name?.trim() && p.role !== "reviewer" && p.is_active !== false && !p.is_minor,
    )
    .map((p) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name!.trim(),
      avatar_url: p.avatar_url,
      medium: p.medium,
    }));
}

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
