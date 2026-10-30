import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getActingOrg } from "@/lib/partner-org";
import { loadOrgMembers } from "@/lib/partner-members";
import { MembersManager } from "./MembersManager";

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

  const loaded = await loadOrgMembers(orgId, user.id);
  if (!loaded) redirect("/dashboard");
  const { orgName, members } = loaded;

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
