"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeBadges } from "@/lib/badges";
import { getDraft } from "@/app/opportunities/[id]/actions";
import type { ApplyModalProps } from "./ApplyModal";
import type { OpportunityApplicationDraft, PipelineConfig, CustomField, OppTypeEnum } from "@/types/database";

const ApplyModal = dynamic(() => import("./ApplyModal").then((m) => m.ApplyModal), { ssr: false });
import type { Artwork } from "@/types/database";

// Only the fields ApplyButton + ApplyModal actually use — avoids serializing
// full_description, organiser, slug, image URLs, and 20+ other unused fields.
export interface OpportunityForApply {
  id: string;
  title: string;
  organiser: string;
  type: OppTypeEnum;
  routing_type: "external" | "pipeline";
  show_badges_in_submission: boolean;
  pipeline_config?: PipelineConfig | null;
  custom_fields: CustomField[];
}

interface ServerProfile {
  id: string;
  full_name: string | null;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  medium: string[] | null;
  exhibition_history: Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }>;
  received_grants: string[];
  is_patronage_supported: boolean;
}

interface Props {
  opportunity: OpportunityForApply;
  isJobOpportunity?: boolean;
  professionalCvUrl?: string | null;
  serverProfile?: ServerProfile | null;
}

export function ApplyButton({ opportunity, isJobOpportunity = false, professionalCvUrl = null, serverProfile = null }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

    const [artworksResult, draft, profileResult] = await Promise.all([
      isJobOpportunity
        ? Promise.resolve({ data: [] as Artwork[] })
        : supabase.from("artworks").select("*").eq("profile_id", user.id).order("position", { ascending: true }),
      opportunity.routing_type === "pipeline"
        ? getDraft(opportunity.id)
        : Promise.resolve(null),
      // Use the server-prefetched profile if available — skips a DB round-trip
      serverProfile
        ? Promise.resolve({ data: serverProfile })
        : supabase.from("profiles").select("id, full_name, username, bio, avatar_url, medium, exhibition_history, received_grants, is_patronage_supported").eq("id", user.id).single(),
    ]);

    const artworks = (artworksResult.data ?? []) as Artwork[];
    const profile = profileResult.data;

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

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        Application submitted. You&apos;ll get an email confirmation, and you can track the status in your{" "}
        <a href="/dashboard?tab=applications" className="underline underline-offset-2 hover:text-foreground transition-colors">
          dashboard
        </a>
        .
      </p>
    );
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
            setSubmitted(true);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
