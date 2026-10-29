import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActingOrg } from "@/lib/partner-org";
import { MembersManager, type MemberRow } from "./MembersManager";

export const metadata: Metadata = {
  title: "Members",
  robots: { index: false, follow: false },
};

/**
 * Who can manage this organisation. Every member is a full owner, alongside the
 * organisation's own login.
 */
export default async function PartnerMembersPage() {
  const { user, orgId } = await getActingOrg();
  if (!user || !orgId) redirect("/auth/login?next=/partner/members");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("profiles")
    .select("id, role, full_name, username")
    .eq("id", orgId)
    .single();
  if (!org || org.role !== "partner") redirect("/dashboard");

  const { data: rows } = await admin
    .from("partner_members")
    .select("user_id, created_at, profile:user_id(full_name, username)")
    .eq("partner_id", orgId)
    .order("created_at", { ascending: true });

  type Row = {
    user_id: string;
    profile: { full_name: string | null; username: string } | { full_name: string | null; username: string }[] | null;
  };

  const people = [
    { userId: orgId, name: (org.full_name ?? org.username) as string, isPrimary: true },
    ...((rows ?? []) as unknown as Row[]).map((r) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return { userId: r.user_id, name: (p?.full_name ?? p?.username ?? "Member") as string, isPrimary: false };
    }),
  ];

  // Emails live in auth.users, not profiles.
  const members: MemberRow[] = await Promise.all(
    people.map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.userId);
      return { ...p, email: data?.user?.email ?? null, isYou: p.userId === user.id };
    }),
  );

  const orgName = (org.full_name ?? org.username) as string;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-1">
        <Link href="/dashboard" className="text-sm text-stone-500 underline underline-offset-2 hover:text-black">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-stone-600">People who manage {orgName} with you.</p>
      </div>
      <MembersManager orgId={orgId} orgName={orgName} members={members} />
    </div>
  );
}
