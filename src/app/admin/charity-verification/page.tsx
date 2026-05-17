export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { CharityVerificationList } from "@/components/admin/CharityVerificationList";
import type { Metadata } from "next";
import type { Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "Charity verification — Patronage admin",
};

export default async function CharityVerificationPage() {
  if (!(await isAdmin())) redirect("/");

  const admin = createAdminClient();
  const { data: charities } = await admin
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, organisation_type, charitable_registration, donation_enabled, donation_url",
    )
    .eq("organisation_type", "charity")
    .order("donation_enabled", { ascending: true })  // pending first
    .order("created_at", { ascending: false });

  const rows = (charities ?? []) as Pick<
    Profile,
    | "id"
    | "username"
    | "full_name"
    | "avatar_url"
    | "organisation_type"
    | "charitable_registration"
    | "donation_enabled"
    | "donation_url"
  >[];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Charity verification</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Charities flagged with a Charities Commission registration. Verify
          the number against the public register before enabling the
          donation CTA on their profile.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-stone-200 rounded-xl px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No charity partners yet.
          </p>
        </div>
      ) : (
        <CharityVerificationList rows={rows} />
      )}
    </div>
  );
}
