import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  // Fetch portfolio works to let artist associate works with the campaign
  const { data: worksData } = await supabase
    .from("portfolio_images")
    .select("id, url, caption, title")
    .eq("profile_id", user.id)
    .eq("is_available", false)
    .order("position", { ascending: true })
    .limit(50);

  const works = (worksData ?? []) as Array<{
    id: string; url: string; caption: string | null; title: string | null;
  }>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/studio?tab=campaigns" className="hover:text-foreground transition-colors">
          Studio
        </Link>
        <span>/</span>
        <Link href="/studio?tab=campaigns" className="hover:text-foreground transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">New campaign</span>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create a campaign</h1>
        <p className="text-sm text-muted-foreground">
          Generate a QR code and landing page for your next show, fair, or public artwork.
        </p>
      </div>

      <NewCampaignForm works={works} username={profile.username ?? ""} />
    </div>
  );
}
