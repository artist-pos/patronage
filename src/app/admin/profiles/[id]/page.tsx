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
    .select("id, username, full_name, bio, website_url, role, account_status")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

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
