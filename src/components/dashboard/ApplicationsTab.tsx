"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { createRealtimeClient } from "@/lib/supabase/client";
import { computeBadges } from "@/lib/badges";
import type { OpportunityApplication, OpportunityApplicationDraft, Opportunity, Artwork } from "@/types/database";
import type { ApplyModalProps } from "@/components/opportunities/ApplyModal";
import { UploadHighResButton } from "./UploadHighResButton";

const ApplyModal = dynamic(() => import("@/components/opportunities/ApplyModal").then((m) => m.ApplyModal), { ssr: false });

interface ApplicationWithOpportunity extends OpportunityApplication {
  opportunity: {
    id: string;
    slug: string | null;
    title: string;
    organiser: string;
    type: string;
    deadline: string | null;
    profile_id: string | null;
    profiles: { full_name: string | null; username: string } | null;
  } | null;
}

interface DraftWithOpportunity extends OpportunityApplicationDraft {
  opportunity: Opportunity | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string; description: string }> = {
  pending: { label: "Received", className: "bg-muted text-muted-foreground", description: "Your application has been submitted." },
  shortlisted: { label: "Under Review", className: "bg-blue-50 text-blue-700 border border-blue-200", description: "The organiser is reviewing applications." },
  selected: { label: "Shortlisted", className: "bg-amber-50 text-amber-700 border border-amber-200", description: "You've been shortlisted." },
  approved_pending_assets: { label: "Upload Required", className: "bg-orange-50 text-orange-700 border border-orange-300", description: "Please upload the requested files." },
  production_ready: { label: "Approved", className: "bg-green-50 text-green-700 border border-green-200", description: "Congratulations — you've been selected." },
  rejected: { label: "Not Selected", className: "bg-muted text-muted-foreground", description: "Not selected this time." },
};

interface ModalState {
  opportunity: Opportunity;
  draft: OpportunityApplicationDraft;
  artistProfile: ApplyModalProps["artistProfile"];
  artistArtworks: Artwork[];
  badges: ApplyModalProps["badges"];
  professionalCvUrl: string | null;
}

interface Props {
  initialApplications: ApplicationWithOpportunity[];
  userId: string;
  initialDrafts?: DraftWithOpportunity[];
}

export function ApplicationsTab({ initialApplications, userId, initialDrafts = [] }: Props) {
  const [applications, setApplications] = useState(initialApplications);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);

  // Realtime subscription
  useEffect(() => {
    const supabase = createRealtimeClient();
    const channel = supabase
      .channel("applications-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "opportunity_applications",
          filter: `artist_id=eq.${userId}`,
        },
        (payload) => {
          setApplications((prev) =>
            prev.map((app) =>
              app.id === payload.new.id
                ? { ...app, ...(payload.new as Partial<ApplicationWithOpportunity>) }
                : app
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function handleContinueDraft(draft: DraftWithOpportunity) {
    if (!draft.opportunity) return;
    setLoadingDraftId(draft.opportunity_id);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingDraftId(null); return; }

    const isJob = draft.opportunity.type === "Job / Employment";

    const [profileResult, artworksResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      isJob
        ? Promise.resolve({ data: [] as Artwork[] })
        : supabase.from("artworks").select("*").eq("profile_id", user.id).order("position", { ascending: true }),
    ]);

    const profile = profileResult.data;
    const artworks = (artworksResult.data ?? []) as Artwork[];

    if (!profile) { setLoadingDraftId(null); return; }

    const badges = computeBadges(
      { ...profile, received_grants: profile.received_grants ?? [] },
      artworks.length,
      artworks.some((a: Artwork) => a.current_owner_id !== a.creator_id)
    );

    setLoadingDraftId(null);
    setModalState({
      opportunity: draft.opportunity,
      draft: {
        id: draft.id,
        opportunity_id: draft.opportunity_id,
        artist_id: user.id,
        artwork_id: draft.artwork_id,
        submitted_image_url: draft.submitted_image_url,
        custom_answers: draft.custom_answers,
        updated_at: draft.updated_at,
      },
      artistProfile: {
        id: profile.id,
        full_name: profile.full_name,
        username: profile.username,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        medium: profile.medium,
        exhibition_history: profile.exhibition_history ?? [],
      },
      artistArtworks: artworks,
      badges,
      professionalCvUrl: profile.professional_cv_url ?? null,
    });
  }

  const isEmpty = applications.length === 0 && drafts.length === 0;

  if (isEmpty) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">No applications yet. When you apply through Patronage, you can track their status here.</p>
        <Link
          href="/opportunities"
          className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
        >
          Browse Opportunities →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Drafts section */}
      {drafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Drafts</p>
          {drafts.map((draft) => {
            const opp = draft.opportunity;
            const isLoading = loadingDraftId === draft.opportunity_id;
            return (
              <div key={draft.id} className="border border-black/40 border-dashed p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    {opp ? (
                      <Link
                        href={`/opportunities/${opp.slug ?? opp.id}`}
                        className="font-semibold text-sm hover:underline truncate block"
                      >
                        {opp.title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-sm text-muted-foreground">Opportunity removed</p>
                    )}
                    <p className="text-xs text-muted-foreground">{opp?.organiser}</p>
                  </div>
                  <span className="shrink-0 text-xs px-2 py-0.5 leading-none bg-muted text-muted-foreground">
                    Draft
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Last saved {new Date(draft.updated_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {opp && (
                  <button
                    type="button"
                    onClick={() => handleContinueDraft(draft)}
                    disabled={isLoading}
                    className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {isLoading ? "Loading…" : "Continue application →"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submitted applications */}
      {applications.length > 0 && (
        <div className="space-y-2">
          {drafts.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Submitted</p>
          )}
          {applications.map((app) => {
            const opp = app.opportunity;
            const statusInfo = STATUS_LABELS[app.status] ?? STATUS_LABELS.pending;
            const partnerName = opp?.profiles?.full_name ?? opp?.profiles?.username ?? opp?.organiser ?? "Partner";

            return (
              <div
                key={app.id}
                className="border border-black p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    {opp ? (
                      <Link
                        href={`/opportunities/${opp.slug ?? opp.id}`}
                        className="font-semibold text-sm hover:underline truncate block"
                      >
                        {opp.title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-sm text-muted-foreground">Opportunity removed</p>
                    )}
                    <p className="text-xs text-muted-foreground">{partnerName}</p>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 leading-none ${statusInfo.className}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{statusInfo.description}</p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Applied {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</span>
                  {opp?.deadline && (
                    <span>Deadline {new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</span>
                  )}
                </div>

                {app.status === "approved_pending_assets" && (
                  <UploadHighResButton applicationId={app.id} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Continue-draft modal */}
      {modalState && (
        <ApplyModal
          opportunity={modalState.opportunity}
          artistProfile={modalState.artistProfile}
          artistArtworks={modalState.artistArtworks}
          badges={modalState.badges}
          draft={modalState.draft}
          isJobOpportunity={modalState.opportunity.type === "Job / Employment"}
          professionalCvUrl={modalState.professionalCvUrl}
          onClose={() => setModalState(null)}
          onSuccess={() => {
            setModalState(null);
            setDrafts((prev) => prev.filter((d) => d.opportunity_id !== modalState.draft.opportunity_id));
          }}
        />
      )}
    </div>
  );
}
