import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import type { ArtworkForGrid } from "@/components/feed/WorksJustifiedGrid";

const WorksJustifiedGrid = dynamic(() =>
  import("@/components/feed/WorksJustifiedGrid").then((m) => ({ default: m.WorksJustifiedGrid }))
);

interface Props {
  params: Promise<{ username: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Not Found" };
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("private_rooms")
    .select("title")
    .eq("artist_profile_id", profile.id)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!room) return { title: "Not Found" };
  return {
    title: `${room.title} — ${profile.full_name ?? profile.username}`,
    robots: { index: false, follow: false },
  };
}

export default async function PrivateRoomPage({ params }: Props) {
  const { username, slug } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const supabase = await createClient();

  const { data: room } = await supabase
    .from("private_rooms")
    .select("id, title, description, show_prices")
    .eq("artist_profile_id", profile.id)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!room) notFound();

  const { data: roomArtworks } = await supabase
    .from("private_room_artworks")
    .select(`
      position,
      artwork:artwork_id (
        id, url, title, caption, price_cents, is_poa, price_currency, medium, hide_price,
        creator_profile:creator_id (username, full_name, avatar_url)
      )
    `)
    .eq("room_id", room.id)
    .order("position", { ascending: true });

  type RawArtwork = {
    id: string; url: string; title: string | null; caption: string | null;
    price_cents: number | null; is_poa: boolean; price_currency: string;
    medium: string | null; hide_price: boolean;
    creator_profile: { username: string; full_name: string | null; avatar_url: string | null } | { username: string; full_name: string | null; avatar_url: string | null }[] | null;
  };

  const artworks: ArtworkForGrid[] = (roomArtworks ?? [])
    .map((ra) => {
      const raw = ra.artwork as unknown as RawArtwork | null;
      if (!raw) return null;
      const cp = Array.isArray(raw.creator_profile) ? raw.creator_profile[0] ?? null : raw.creator_profile;
      return {
        id: raw.id,
        url: raw.url,
        title: raw.title,
        caption: raw.caption,
        price_cents: raw.price_cents,
        is_poa: raw.is_poa,
        price_currency: raw.price_currency as "NZD" | "AUD",
        medium: raw.medium,
        hide_price: !room.show_prices || raw.hide_price,
        profile: cp
          ? { username: cp.username, full_name: cp.full_name, avatar_url: cp.avatar_url }
          : null,
      } satisfies ArtworkForGrid;
    })
    .filter((a) => a !== null) as ArtworkForGrid[];

  const displayName = profile.full_name ?? profile.username;

  return (
    <div className="min-h-screen bg-background">
      {/* Hide site header and footer */}
      <style dangerouslySetInnerHTML={{ __html: `body > header, body > footer { display: none !important; } body > main { padding: 0 !important; }` }} />

      {/* Room header */}
      <div className="px-6 py-8 border-b border-border">
        <div className="max-w-[1600px] mx-auto flex items-start justify-between gap-8">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Private Viewing Room</p>
            <h1 className="text-xl font-semibold">{room.title}</h1>
            {room.description && (
              <p className="text-sm text-muted-foreground mt-1">{room.description}</p>
            )}
          </div>
          <Link
            href={`/${username}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
          >
            {displayName} →
          </Link>
        </div>
      </div>

      {/* Works grid */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        {artworks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No works in this room yet.</p>
        ) : (
          <WorksJustifiedGrid artworks={artworks} />
        )}
      </div>
    </div>
  );
}
