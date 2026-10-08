export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminProfileEditor } from "@/components/admin/AdminProfileEditor";

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
    </div>
  );
}
