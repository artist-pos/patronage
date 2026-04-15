import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CampaignConfigPanel } from "@/components/campaigns/CampaignConfigPanel";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Campaign — Studio — Patronage" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
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

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(`
      id, title, slug, campaign_type, status, production_status,
      partner_name, partner_profile_id,
      campaign_start_date, campaign_end_date,
      location_address, location_lat, location_lng,
      surface_type, production_specs, fee_amount,
      qr_code_url, landing_page_slug, landing_page_config,
      created_at, updated_at,
      opportunity_id, application_id
    `)
    .eq("id", id)
    .eq("artist_profile_id", user.id)
    .single();

  if (!campaign) redirect("/studio?tab=campaigns");

  const { data: filesData } = await supabase
    .from("campaign_files")
    .select("id, file_url, file_name, file_type, file_size_bytes, notes, created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  const files = (filesData ?? []) as Array<{
    id: string; file_url: string; file_name: string;
    file_type: string | null; file_size_bytes: number | null;
    notes: string | null; created_at: string;
  }>;

  const c = campaign as {
    id: string; title: string; slug: string; campaign_type: string;
    status: string; production_status: string;
    partner_name: string | null; partner_profile_id: string | null;
    campaign_start_date: string | null; campaign_end_date: string | null;
    location_address: string | null; location_lat: number | null; location_lng: number | null;
    surface_type: string | null; production_specs: string | null; fee_amount: number | null;
    qr_code_url: string | null; landing_page_slug: string | null;
    landing_page_config: Record<string, unknown>;
    created_at: string; updated_at: string;
    opportunity_id: string | null; application_id: string | null;
  };

  const landingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/live/${c.slug}/${profile.username}`;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
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
        <span className="text-foreground font-medium truncate">{c.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide ${
              c.status === "live" ? "bg-green-100 text-green-700"
                : c.status === "completed" ? "bg-stone-100 text-stone-500"
                : "bg-stone-100 text-stone-600"
            }`}>
              {c.status}
            </span>
            <span className="text-xs text-muted-foreground">{c.campaign_type.replace("_", " ")}</span>
            {c.partner_name && (
              <span className="text-xs text-muted-foreground">· {c.partner_name}</span>
            )}
          </div>
        </div>
        {c.qr_code_url && (
          <a
            href={c.qr_code_url}
            download={`${c.slug}-qr.png`}
            className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors whitespace-nowrap shrink-0"
          >
            Download QR →
          </a>
        )}
      </div>

      <CampaignConfigPanel
        campaign={c}
        files={files}
        landingUrl={landingUrl}
        artistId={user.id}
        username={profile.username ?? ""}
      />
    </div>
  );
}
