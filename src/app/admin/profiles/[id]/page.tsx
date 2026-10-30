export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminProfileEditor } from "@/components/admin/AdminProfileEditor";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { loadOrgMembers } from "@/lib/partner-members";
import { MembersManager } from "@/app/partner/members/MembersManager";
import { RosterManager, type RosterEntry } from "@/app/partner/roster/RosterManager";
import { canKeepRoster, orgCategory } from "@/lib/org-categories";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Edit profile — Admin" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProfileEditPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, bio, website_url, role, account_status, org_category")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  // A roster outlives a change of type, so say how many entries are attached.
  let rosterCount = 0;
  if (profile.role === "partner") {
    const { data: roster } = await supabase
      .from("collectives")
      .select("id")
      .eq("org_profile_id", profile.id)
      .limit(1)
      .maybeSingle();
    if (roster) {
      const { count } = await supabase
        .from("collective_members")
        .select("user_id", { count: "exact", head: true })
        .eq("collective_id", roster.id);
      rosterCount = count ?? 0;
    }
  }

  // The organisation's roster, when its type keeps one. Entries start pending: the
  // artist confirms before they appear on the public page.
  let rosterEntries: RosterEntry[] = [];
  const keepsRoster = profile.role === "partner" && canKeepRoster(profile.org_category);
  const category = orgCategory(profile.org_category);
  if (keepsRoster) {
    const admin = createAdminClient();
    const { data: rosterRow } = await admin
      .from("collectives")
      .select("id")
      .eq("org_profile_id", profile.id)
      .limit(1)
      .maybeSingle();
    if (rosterRow) {
      const { data: memberRows } = await admin
        .from("collective_members")
        .select(
          "id, user_id, status, start_year, end_year, profiles!collective_members_user_id_fkey(username, full_name, avatar_url, city)",
        )
        .eq("collective_id", (rosterRow as { id: string }).id)
        .order("start_year", { ascending: false, nullsFirst: false });
      rosterEntries = (
        (memberRows ?? []) as unknown as Array<{
          id: string;
          user_id: string;
          status: string;
          start_year: number | null;
          end_year: number | null;
          profiles: { username: string; full_name: string | null; avatar_url: string | null; city: string | null } | null;
        }>
      ).map((m) => ({
        membershipId: m.id,
        artistId: m.user_id,
        username: m.profiles?.username ?? "",
        fullName: m.profiles?.full_name ?? null,
        avatarUrl: m.profiles?.avatar_url ?? null,
        city: m.profiles?.city ?? null,
        accepted: m.status === "accepted",
        startYear: m.start_year,
        endYear: m.end_year,
      }));
    }
  }

  const { user } = await getServerUser();
  const members = profile.role === "partner" ? await loadOrgMembers(profile.id, user?.id ?? "") : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Edit {profile.full_name ?? profile.username}
        </h1>
        <p className="text-xs text-muted-foreground">
          {profile.account_status === "shadow"
            ? "Unclaimed shadow profile. Whatever you add here is what they find when they claim it."
            : "Claimed profile. Changes go live straight away."}{" "}
          <Link href={`/${profile.username}`} target="_blank" className="underline underline-offset-2">
            View public page
          </Link>{" "}
          ·{" "}
          <Link href="/admin/artists" className="underline underline-offset-2">
            Back to artists
          </Link>
        </p>
      </div>
      <AdminProfileEditor
        profileId={profile.id}
        orgType={profile.role === "partner" ? { value: profile.org_category ?? "", rosterCount } : null}
        defaults={{
          full_name: profile.full_name ?? "",
          bio: profile.bio ?? "",
          website_url: profile.website_url ?? "",
          username: profile.username,
        }}
      />
      {profile.role === "partner" && (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-sm font-semibold">
            {category?.hasMembers ? "Members" : category?.hasAlumni ? "Participants and alumni" : "Represented artists"}
          </h2>
          {keepsRoster ? (
            <>
              <p className="max-w-xl text-xs text-muted-foreground">
                Add the artists who belong on this page. By default each one is sent an invitation and only appears
                publicly once they accept. Tick &ldquo;they&rsquo;ve already agreed&rdquo; to list someone straight
                away.
              </p>
              <RosterManager
                orgId={profile.id}
                canListNow
                entries={rosterEntries}
                isAlumni={category?.hasAlumni ?? false}
                rosterNoun={category?.rosterNoun ?? "artist"}
              />
            </>
          ) : (
            <p className="max-w-xl text-xs text-muted-foreground">
              This organisation type doesn&rsquo;t keep an artist list. Set it to a gallery, residency, art society
              or school above to add one.
            </p>
          )}
        </section>
      )}
      {profile.role === "partner" && members && (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-sm font-semibold">Owners (who can manage this page)</h2>
          <p className="max-w-xl text-xs text-muted-foreground">
            Add anyone, by @username or email, who should manage this organisation. Owners aren&rsquo;t the
            public list above: use &ldquo;Add to roster&rdquo; beside an artist to show them there. If they already have a Patronage account
            (an artist, for example) it is linked and keeps its own profile; otherwise one is made. They are emailed
            a sign-in link that opens this organisation&rsquo;s dashboard.
          </p>
          <MembersManager
            noun="owner"
            orgId={profile.id}
            orgName={members.orgName}
            members={members.members}
            roster={keepsRoster ? { onRosterIds: rosterEntries.filter((e) => e.accepted).map((e) => e.artistId) } : undefined}
          />
        </section>
      )}
    </div>
  );
}
