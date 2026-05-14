import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudioPageShell } from "../StudioPageShell";
import { RoomsManager } from "./RoomsManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Viewing Rooms — Studio — Patronage" };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export default async function StudioRoomsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    redirect("/dashboard");
  }

  const [roomsResult, artworksResult] = await Promise.all([
    supabase
      .from("private_rooms")
      .select("id, title, slug, description, show_prices, is_active, created_at")
      .eq("artist_profile_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("artworks")
      .select("id, url, caption, title")
      .eq("profile_id", user.id)
      .eq("is_available", true)
      .order("position", { ascending: true }),
  ]);

  const rooms = roomsResult.data ?? [];

  // Fetch artwork counts per room
  const roomIds = rooms.map((r) => r.id);
  const countMap: Record<string, number> = {};
  if (roomIds.length > 0) {
    const { data: counts } = await supabase
      .from("private_room_artworks")
      .select("room_id")
      .in("room_id", roomIds);
    for (const row of counts ?? []) {
      countMap[row.room_id] = (countMap[row.room_id] ?? 0) + 1;
    }
  }

  const initialRooms = rooms.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description ?? null,
    show_prices: r.show_prices ?? true,
    is_active: r.is_active ?? true,
    created_at: r.created_at,
    artwork_count: countMap[r.id] ?? 0,
  }));

  const availableArtworks = (artworksResult.data ?? []).map((a) => ({
    id: a.id,
    url: a.url,
    caption: a.caption,
    title: a.title,
  }));

  return (
    <StudioPageShell username={profileRow.username} activeSection="rooms">
      <div className="space-y-6 max-w-3xl">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Viewing Rooms</h2>
          <p className="text-sm text-muted-foreground">
            Create private shareable URLs with a curated selection of your works. Share the link directly with collectors and gallerists.
          </p>
        </div>
        <RoomsManager
          initialRooms={initialRooms}
          availableArtworks={availableArtworks}
          username={profileRow.username}
          siteUrl={SITE_URL}
        />
      </div>
    </StudioPageShell>
  );
}
