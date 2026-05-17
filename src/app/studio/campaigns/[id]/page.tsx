import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioPageShell } from "@/app/studio/StudioPageShell";
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
    .select("role, username, bio, featured_image_url")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/dashboard");
  }

  const [{ data: campaign }, { data: filesData }, { data: worksData }] = await Promise.all([
    supabase
      .from("campaigns")
      .select(`
        id, title, slug, campaign_type, status, production_status,
        partner_name, partner_profile_id,
        campaign_start_date, campaign_end_date,
        location_address, location_lat, location_lng,
        venue_contact_name, venue_contact_email, venue_contact_phone,
        surface_type, production_specs, fee_amount,
        qr_code_url, landing_page_slug, landing_page_config, hero_work_id,
        created_at, updated_at,
        opportunity_id, application_id
      `)
      .eq("id", id)
      .eq("artist_profile_id", user.id)
      .single(),
    supabase
      .from("campaign_files")
      .select("id, file_url, file_name, file_type, file_size_bytes, notes, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("artworks")
      .select("id, url, caption, title, content_type")
      .eq("profile_id", user.id)
      .order("position", { ascending: true })
      .limit(100),
  ]);

  if (!campaign) redirect("/studio?section=campaigns");

  const files = (filesData ?? []) as Array<{
    id: string; file_url: string; file_name: string;
    file_type: string | null; file_size_bytes: number | null;
    notes: string | null; created_at: string;
  }>;

  const works = (worksData ?? []) as Array<{
    id: string; url: string | null; caption: string | null;
    title: string | null; content_type?: string;
  }>;

  const c = campaign as {
    id: string; title: string; slug: string; campaign_type: string;
    status: string; production_status: string;
    partner_name: string | null; partner_profile_id: string | null;
    campaign_start_date: string | null; campaign_end_date: string | null;
    location_address: string | null; location_lat: number | null; location_lng: number | null;
    venue_contact_name: string | null; venue_contact_email: string | null; venue_contact_phone: string | null;
    surface_type: string | null; production_specs: string | null; fee_amount: number | null;
    qr_code_url: string | null; landing_page_slug: string | null;
    landing_page_config: Record<string, unknown>; hero_work_id: string | null;
    created_at: string; updated_at: string;
    opportunity_id: string | null; application_id: string | null;
  };

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const landingUrl = `${SITE_URL}/live/${c.slug}/${profile.username}`;

  return (
    <StudioPageShell username={profile.username ?? ""} activeSection="campaigns">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/studio?section=campaigns" className="hover:text-foreground transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{c.title}</span>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground capitalize">
            {c.campaign_type.replace(/_/g, " ")}
          </span>
          {c.partner_name && (
            <span className="text-xs text-muted-foreground">· {c.partner_name}</span>
          )}
          {c.opportunity_id && (
            <span className="text-[10px] border border-stone-300 text-stone-500 px-1.5 py-0.5 leading-none">
              Partner campaign
            </span>
          )}
        </div>
      </div>

      <CampaignConfigPanel
        campaign={c}
        files={files}
        landingUrl={landingUrl}
        artistId={user.id}
        username={profile.username ?? ""}
        works={works}
        profileId={user.id}
        bio={(profile as { bio?: string | null }).bio ?? null}
        featuredImageUrl={(profile as { featured_image_url?: string | null }).featured_image_url ?? null}
      />
    </StudioPageShell>
  );
}
