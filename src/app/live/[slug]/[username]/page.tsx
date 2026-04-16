import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { LiveStorefrontClient } from "./LiveStorefrontClient";

interface PageProps {
  params: Promise<{ slug: string; username: string }>;
  searchParams: Promise<{ work?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, username } = await params;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("username", username)
    .single();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("title")
    .eq("slug", slug)
    .single();
  const name = profile?.full_name ?? profile?.username ?? username;
  const title = campaign?.title ?? "Storefront";
  return {
    title: `${title} — ${name} — Patronage`,
    description: `View ${name}'s campaign on Patronage.`,
  };
}

export default async function LiveStorefrontPage({ params, searchParams }: PageProps) {
  const { slug, username } = await params;
  const { work: highlightWorkId } = await searchParams;

  const admin = createAdminClient();

  const [{ data: profile }, { data: campaign }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, username, bio, avatar_url, featured_image_url")
      .eq("username", username)
      .single(),
    admin
      .from("campaigns")
      .select("id, title, slug, status, campaign_type, landing_page_config, partner_name, campaign_start_date, campaign_end_date, location_address")
      .eq("slug", slug)
      .single(),
  ]);

  if (!profile || !campaign) notFound();
  if (campaign.status !== "live") notFound();

  const cfg = (campaign.landing_page_config ?? {}) as {
    hero_work_id?: string;
    selected_work_ids?: string[];
    layout_mode?: "shopfront" | "showcase";
    work_pricing?: Record<string, { available?: boolean; price?: number | null; is_poa?: boolean }>;
    original_available?: boolean;
    original_price?: number | null;
    is_poa?: boolean;
    prints_available?: boolean;
    print_sizes?: Array<{ size: string; price: string }>;
    edition_size?: string;
    paper_stock?: string;
    artist_statement?: string;
  };

  const allWorkIds = [
    ...(cfg.hero_work_id && cfg.hero_work_id !== "profile_featured" ? [cfg.hero_work_id] : []),
    ...(cfg.selected_work_ids ?? []).filter(id => id !== cfg.hero_work_id),
  ];

  // Fetch portfolio works referenced in the campaign config
  const works = allWorkIds.length > 0
    ? await admin
        .from("portfolio_images")
        .select("id, url, caption, title, content_type")
        .in("id", allWorkIds)
        .then(({ data }) => data ?? [])
    : [];

  // Resolve hero image URL
  let heroImageUrl: string | null = null;
  if (cfg.hero_work_id === "profile_featured") {
    heroImageUrl = (profile as { featured_image_url?: string | null }).featured_image_url ?? null;
  } else if (cfg.hero_work_id) {
    const heroWork = works.find(w => w.id === cfg.hero_work_id);
    heroImageUrl = heroWork?.url ?? null;
  }

  // Sort works to match selected_work_ids order, hero first
  const orderedWorks = allWorkIds
    .map(id => works.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w);

  const p = profile as {
    id: string; full_name: string | null; username: string;
    bio: string | null; avatar_url: string | null; featured_image_url: string | null;
  };
  const c = campaign as {
    id: string; title: string; slug: string; status: string; campaign_type: string;
    landing_page_config: Record<string, unknown>;
    partner_name: string | null;
    campaign_start_date: string | null; campaign_end_date: string | null;
    location_address: string | null;
  };

  return (
    <LiveStorefrontClient
      campaign={c}
      profile={p}
      heroImageUrl={heroImageUrl}
      works={orderedWorks}
      cfg={cfg}
      highlightWorkId={highlightWorkId ?? null}
      artistEmail={null /* not exposed to client */}
    />
  );
}
