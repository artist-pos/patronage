import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { StudioPageShell } from "@/app/studio/StudioPageShell";
import { SeriesEditorClient } from "./SeriesEditorClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Series — Studio — Patronage" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSeriesPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const [profileResult, seriesResult] = await Promise.all([
    supabase.from("profiles").select("role, username").eq("id", user.id).single(),
    supabase.from("series").select("id, title, slug, hero_image_url, description, year").eq("id", id).eq("artist_id", user.id).single(),
  ]);

  const profile = profileResult.data;
  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) redirect("/studio");

  const series = seriesResult.data;
  if (!series) notFound();

  const { data: artworksRaw } = await supabase
    .from("series_artworks")
    .select("position, artwork:artwork_id(id, url, caption, title, medium, year, slug, is_available, price_cents, is_poa, price_currency)")
    .eq("series_id", id)
    .order("position", { ascending: true });

  const artworks = (artworksRaw ?? []).flatMap((row) => {
    const aw = row.artwork as unknown as {
      id: string; url: string; caption: string | null; title: string | null;
      medium: string | null; year: number | null; slug: string | null;
      is_available: boolean; price_cents: number | null; is_poa: boolean; price_currency: string;
    } | null;
    if (!aw) return [];
    return [{ ...aw, position: row.position }];
  });

  return (
    <StudioPageShell username={profile.username ?? ""} activeSection="works">
      <SeriesEditorClient
        profileId={user.id}
        artistUsername={profile.username ?? ""}
        series={series}
        initialArtworks={artworks}
      />
    </StudioPageShell>
  );
}
