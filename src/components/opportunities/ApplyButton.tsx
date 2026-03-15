"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeBadges } from "@/lib/badges";
import { getDraft } from "@/app/opportunities/[id]/actions";
import type { ApplyModalProps } from "./ApplyModal";
import type { OpportunityApplicationDraft } from "@/types/database";

const ApplyModal = dynamic(() => import("./ApplyModal").then((m) => m.ApplyModal), { ssr: false });
import type { Opportunity, Artwork } from "@/types/database";

interface Props {
  opportunity: Opportunity;
  isJobOpportunity?: boolean;
  professionalCvUrl?: string | null;
}

export function ApplyButton({ opportunity, isJobOpportunity = false, professionalCvUrl = null }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applicantData, setApplicantData] = useState<{
    profile: ApplyModalProps["artistProfile"];
    artworks: Artwork[];
    badges: ApplyModalProps["badges"];
    draft: OpportunityApplicationDraft | null;
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

    const [profileResult, artworksResult, draft] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      isJobOpportunity
        ? Promise.resolve({ data: [] })
        : supabase.from("artworks").select("*").eq("profile_id", user.id).order("position", { ascending: true }),
      opportunity.routing_type === "pipeline"
        ? getDraft(opportunity.id)
        : Promise.resolve(null),
    ]);

    const profile = profileResult.data;
    const artworks = (artworksResult.data ?? []) as Artwork[];

    if (profile) {
      const collectedSet = artworks.some((a: Artwork) => a.current_owner_id !== a.creator_id);
      const badges = computeBadges(
        { ...profile, received_grants: profile.received_grants ?? [] },
        artworks.length,
        collectedSet
      );
      setApplicantData({
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          username: profile.username,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          medium: profile.medium,
          exhibition_history: profile.exhibition_history ?? [],
        },
        artworks,
        badges,
        draft: draft as OpportunityApplicationDraft | null,
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

      {open && applicantData && (
        <ApplyModal
          opportunity={opportunity}
          artistProfile={applicantData.profile}
          artistArtworks={applicantData.artworks}
          badges={applicantData.badges}
          draft={applicantData.draft}
          isJobOpportunity={isJobOpportunity}
          professionalCvUrl={professionalCvUrl}
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
