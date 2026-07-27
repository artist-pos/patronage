"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Lock, Lightbulb } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeBadges } from "@/lib/badges";
import { getMissingFields, isProfileComplete } from "@/lib/profile-completion";
import { getDraft } from "@/app/opportunities/[id]/actions";
import type { ApplyModalProps } from "./ApplyModal";
import type { OpportunityApplicationDraft, PipelineConfig, CustomField, OppTypeEnum, CreativeWork } from "@/types/database";

const ApplyModal = dynamic(() => import("./ApplyModal").then((m) => m.ApplyModal), { ssr: false });

export interface OpportunityForApply {
  id: string;
  title: string;
  organiser: string;
  type: OppTypeEnum;
  routing_type: "external" | "pipeline";
  show_badges_in_submission: boolean;
  pipeline_config?: PipelineConfig | null;
  custom_fields: CustomField[];
  // Reference fields — shown in the ApplyModal side panel so artists can check
  // the brief while writing, without leaving the application.
  country?: string;
  city?: string | null;
  caption?: string | null;
  full_description?: string | null;
  funding_range?: string | null;
  funding_amount?: number | null;
  deadline?: string | null;
  opens_at?: string | null;
  entry_fee?: number | null;
  entry_fee_currency?: string | null;
  artist_payment_type?: string | null;
  travel_support?: boolean | null;
  travel_support_details?: string | null;
  sub_categories?: string[] | null;
  featured_image_url?: string | null;
}

interface ServerProfile {
  id: string;
  full_name: string | null;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  medium: string[] | null;
  disciplines: string[] | null;
  city: string | null;
  exhibition_history: Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }>;
  received_grants: string[];
  is_patronage_supported: boolean;
}

interface MissingField {
  key: string;
  label: string;
  href: string;
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
  const [lockedFields, setLockedFields] = useState<MissingField[] | null>(null);
  const [showVerifiedTip, setShowVerifiedTip] = useState(false);
  const [applicantData, setApplicantData] = useState<{
    profile: ApplyModalProps["artistProfile"];
    artistWorks: CreativeWork[];
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

    const [worksResult, artworkBadgeResult, draft, profileResult] = await Promise.all([
      isJobOpportunity
        ? Promise.resolve({ data: [] as CreativeWork[] })
        : supabase
            .from("creative_works")
            .select("id, profile_id, content_type, title, caption, image_url, audio_url, video_url, text_content, embed_url, embed_provider, year_created, position")
            .eq("profile_id", user.id)
            .order("position", { ascending: true }),
      isJobOpportunity
        ? Promise.resolve({ data: [] as { current_owner_id: string; creator_id: string }[] })
        : supabase.from("artworks").select("current_owner_id, creator_id").eq("profile_id", user.id),
      opportunity.routing_type === "pipeline"
        ? getDraft(opportunity.id)
        : Promise.resolve(null),
      serverProfile
        ? Promise.resolve({ data: serverProfile })
        : supabase.from("profiles").select("id, full_name, username, bio, avatar_url, medium, disciplines, city, exhibition_history, received_grants, is_patronage_supported").eq("id", user.id).single(),
    ]);

    const artistWorks = (worksResult.data ?? []) as CreativeWork[];
    const artworksBadge = (artworkBadgeResult.data ?? []) as { current_owner_id: string; creator_id: string }[];
    const profile = profileResult.data;

    if (profile) {
      // Gate pipeline applications behind the "Verified" badge — bio + avatar +
      // at least 3 works (see computeBadges in src/lib/badges.ts). Job opportunities
      // don't fetch works at all (isJobOpportunity above), so they're exempt.
      if (opportunity.routing_type === "pipeline") {
        const missing: MissingField[] = getMissingFields({
          avatar_url: profile.avatar_url,
          full_name: profile.full_name,
          bio: profile.bio,
          disciplines: (profile.disciplines ?? []) as string[],
          city: profile.city ?? null,
        });
        if (!isJobOpportunity && artistWorks.length < 3) {
          missing.push({
            key: "works",
            label: `${3 - artistWorks.length} more work${3 - artistWorks.length !== 1 ? "s" : ""} in your portfolio`,
            href: `/${profile.username}?tab=work`,
          });
        }
        if (missing.length > 0) {
          setLockedFields(missing);
          setLoading(false);
          return;
        }
      }

      const collectedSet = artworksBadge.some((a) => a.current_owner_id !== a.creator_id);
      const badges = computeBadges(
        { ...profile, received_grants: profile.received_grants ?? [] },
        artistWorks.length,
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
        artistWorks,
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

  // Locked state — shown after handleOpen() determines profile is incomplete.
  if (lockedFields) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 border border-dashed border-stone-300 px-4 py-3 rounded-lg text-sm text-muted-foreground">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            You need a Verified profile to apply — partners review your profile alongside your application.
          </span>
          <button
            type="button"
            onClick={() => setShowVerifiedTip((v) => !v)}
            className="text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            aria-label="What does Verified mean?"
          >
            <Lightbulb className="w-3.5 h-3.5" />
          </button>
        </div>
        {showVerifiedTip && (
          <p className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-3">
            Verified means your profile has a photo, a bio, and at least 3 works in your portfolio — it&apos;s the same badge shown on your public profile.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Add:{" "}
          {lockedFields.map((f, i) => (
            <span key={f.key}>
              {i > 0 && ", "}
              <Link
                href={f.href}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {f.label}
              </Link>
            </span>
          ))}
        </p>
      </div>
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
          artistWorks={applicantData.artistWorks}
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
