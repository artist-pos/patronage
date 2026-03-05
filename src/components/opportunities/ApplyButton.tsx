"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ApplyModal } from "./ApplyModal";
import { computeBadges } from "@/lib/badges";
import type { Opportunity, Artwork } from "@/types/database";

interface Props {
  opportunity: Opportunity;
}

export function ApplyButton({ opportunity }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [artistData, setArtistData] = useState<{
    profile: Parameters<typeof ApplyModal>[0]["artistProfile"];
    artworks: Artwork[];
    badges: Parameters<typeof ApplyModal>[0]["badges"];
  } | null>(null);
  const router = useRouter();

  async function handleOpen() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const [profileResult, artworksResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("artworks").select("*").eq("profile_id", user.id).order("position", { ascending: true }),
    ]);

    const profile = profileResult.data;
    const artworks = artworksResult.data ?? [];

    if (profile) {
      const collectedSet = artworks.some((a: Artwork) => a.current_owner_id !== a.creator_id);
      const badges = computeBadges(
        { ...profile, received_grants: profile.received_grants ?? [] },
        artworks.length,
        collectedSet
      );
      setArtistData({
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          username: profile.username,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          medium: profile.medium,
          exhibition_history: profile.exhibition_history ?? [],
        },
        artworks: artworks as Artwork[],
        badges,
      });
    }
    setLoading(false);
    setOpen(true);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading}
        className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors disabled:opacity-50"
      >
        {loading ? "Loading…" : "Apply with Patronage →"}
      </button>

      {open && artistData && (
        <ApplyModal
          opportunity={opportunity}
          artistProfile={artistData.profile}
          artistArtworks={artistData.artworks}
          badges={artistData.badges}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
