import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { SeriesDetailClient } from "./SeriesDetailClient";
import type { SeriesWork, SeriesEditionOption } from "@/types/database";

interface Props {
  params: Promise<{ username: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = await createClient();
  const profile = await getProfile(username);
  if (!profile) return { title: "Series not found | Patronage" };
  const { data: series } = await supabase
    .from("series")
    .select("title, description, hero_image_url")
    .eq("artist_id", profile.id)
    .eq("slug", slug)
    .single();
  if (!series) return { title: "Series not found | Patronage" };
  const artistName = profile.full_name ?? profile.username;
  return {
    title: `${series.title}, ${artistName} | Patronage`,
    description: series.description?.slice(0, 155) ?? `${series.title} by ${artistName}.`,
    openGraph: { images: series.hero_image_url ? [{ url: series.hero_image_url }] : [] },
  };
}

export default async function SeriesDetailPage({ params }: Props) {
  const { username, slug } = await params;
  const supabase = await createClient();

  const [profile, authResult] = await Promise.all([
    getProfile(username),
    supabase.auth.getUser(),
  ]);
  if (!profile) notFound();

  const { data: series } = await supabase
    .from("series")
    .select("id, title, description, hero_image_url")
    .eq("artist_id", profile.id)
    .eq("slug", slug)
    .single();
  if (!series) notFound();

  const { data: artworksRaw } = await supabase
    .from("series_artworks")
    .select("position, artwork:artwork_id(id, url, caption, title, medium, year, dimensions, slug, is_available, price_cents, is_poa, price_currency, hide_price, acquisition_mode, listing_mode)")
    .eq("series_id", series.id)
    .order("position", { ascending: true });

  const artworks: SeriesWork[] = (artworksRaw ?? []).flatMap((row) => {
    const aw = row.artwork as unknown as Omit<SeriesWork, "position" | "editions"> | null;
    if (!aw) return [];
    return [{ ...aw, position: row.position, editions: [] }];
  });

  // Fetch editions for available works
  const availableIds = artworks.filter(a => a.is_available).map(a => a.id);
  const editionsData = availableIds.length > 0
    ? await supabase
        .from("editions")
        .select("id, work_id, label, type, price_cents, currency, poa, listing_mode, listed, dimensions, sort_order")
        .in("work_id", availableIds)
        .eq("listed", true)
        .order("sort_order", { ascending: true })
        .then(({ data }) => data ?? [])
    : [];

  const editionsMap: Record<string, SeriesEditionOption[]> = {};
  for (const ed of editionsData) {
    if (!editionsMap[ed.work_id]) editionsMap[ed.work_id] = [];
    editionsMap[ed.work_id].push({
      id: ed.id,
      label: ed.label,
      type: ed.type,
      price_cents: ed.price_cents ?? null,
      currency: ed.currency ?? "NZD",
      poa: ed.poa ?? false,
      listing_mode: ed.listing_mode ?? "enquire",
      listed: ed.listed ?? false,
      dimensions: ed.dimensions ?? null,
      sort_order: ed.sort_order ?? 0,
    });
  }

  const enrichedArtworks = artworks.map(a => ({ ...a, editions: editionsMap[a.id] ?? [] }));

  const viewer = authResult.data.user;
  const isOwner = viewer?.id === profile.id;
  const artistName = profile.full_name ?? profile.username;

  return (
    <SeriesDetailClient
      series={{ id: series.id, title: series.title, description: series.description }}
      artworks={enrichedArtworks}
      artistName={artistName}
      artistUsername={username}
      isOwner={isOwner}
      seriesId={series.id}
      seriesSlug={slug}
    />
  );
}
