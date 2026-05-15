import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioPageShell } from "@/app/studio/StudioPageShell";
import { NewCampaignForm } from "@/components/campaigns/NewCampaignForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Campaign — Studio — Patronage" };

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/dashboard");
  }

  return (
    <StudioPageShell username={profile.username ?? ""} activeSection="campaigns">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/studio?section=campaigns" className="hover:text-foreground transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">New campaign</span>
      </div>

      <div className="space-y-1 mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Create a campaign</h1>
        <p className="text-sm text-muted-foreground">
          Generate a QR code and storefront for your next show, fair, or pop-up.
        </p>
      </div>

      <NewCampaignForm username={profile.username ?? ""} />
    </StudioPageShell>
  );
}
