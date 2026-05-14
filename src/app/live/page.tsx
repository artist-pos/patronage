import { createClient } from "@/lib/supabase/server";
import { CampaignFilters } from "@/components/live/CampaignFilters";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Campaigns — Patronage",
  description: "Public art activations, art fairs, grant-funded projects and residencies happening across Aotearoa right now.",
};

export default async function LivePage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("campaigns")
    .select(`
      id, slug, title, campaign_type, cover_image_url, location_address, is_featured,
      artist_id,
      profiles!campaigns_artist_id_fkey(username, full_name, avatar_url, region),
      opportunities!campaigns_opportunity_id_fkey(title, type)
    `)
    .eq("status", "live")
    .order("created_at", { ascending: false });

  const campaigns = (rows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const opp = Array.isArray(row.opportunities) ? row.opportunities[0] : row.opportunities;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      campaign_type: row.campaign_type ?? null,
      cover_image_url: (row as { cover_image_url?: string | null }).cover_image_url ?? null,
      location_address: row.location_address ?? null,
      is_featured: (row as { is_featured?: boolean }).is_featured ?? false,
      opportunity_type: (opp as { type?: string } | null)?.type ?? null,
      opportunity_title: (opp as { title?: string } | null)?.title ?? null,
      artist: {
        username: (profile as { username: string }).username,
        full_name: (profile as { full_name?: string | null }).full_name ?? null,
        avatar_url: (profile as { avatar_url?: string | null }).avatar_url ?? null,
        region: (profile as { region?: string | null }).region ?? null,
      },
    };
  });

  const uniqueArtists = new Set(campaigns.map((c) => c.artist.username)).size;
  const uniqueRegions = new Set(campaigns.map((c) => c.artist.region).filter(Boolean)).size;

  const featured = campaigns.find((c) => c.is_featured);

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12 space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h1 className="text-2xl font-semibold tracking-tight">Active campaigns</h1>
        </div>
        <p className="text-sm text-stone-600 max-w-xl leading-relaxed">
          Public art activations, art fairs, grant-funded projects and residencies happening across Aotearoa right now.
        </p>
        <div className="flex gap-6 text-sm text-stone-500">
          <span>{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</span>
          <span>{uniqueArtists} artist{uniqueArtists !== 1 ? "s" : ""}</span>
          {uniqueRegions > 0 && (
            <span>{uniqueRegions} region{uniqueRegions !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Featured banner */}
      {featured && (
        <a
          href={`/live/${featured.slug}/${featured.artist.username}`}
          className="block border border-stone-200 rounded-xl overflow-hidden hover:border-stone-300 transition-colors"
        >
          <div className="flex items-stretch min-h-[160px]">
            {featured.cover_image_url && (
              <div className="w-64 shrink-0 bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featured.cover_image_url}
                  alt={featured.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 px-6 py-5 flex flex-col justify-center gap-2 bg-white">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  Featured
                </span>
                {featured.opportunity_type && (
                  <span className="text-[10px] bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">
                    {featured.opportunity_type}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-stone-900">{featured.title}</h2>
              <p className="text-sm text-stone-500">
                {featured.artist.full_name ?? featured.artist.username}
                {featured.artist.region ? ` · ${featured.artist.region}` : ""}
              </p>
              <span className="text-sm text-stone-900 underline underline-offset-2 mt-1">
                View campaign →
              </span>
            </div>
          </div>
        </a>
      )}

      {/* Campaign grid with filters */}
      {campaigns.length < 3 ? (
        <div className="border border-dashed border-stone-200 rounded-xl px-8 py-20 text-center">
          <p className="text-sm text-stone-500">Live campaigns are coming soon.</p>
          <p className="text-xs text-stone-400 mt-1">We're onboarding our first artists — check back shortly.</p>
        </div>
      ) : (
        <CampaignFilters campaigns={campaigns} />
      )}
    </main>
  );
}
