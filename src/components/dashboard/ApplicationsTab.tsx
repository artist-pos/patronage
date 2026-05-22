"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { createRealtimeClient } from "@/lib/supabase/client";
import { computeBadges } from "@/lib/badges";
import type { OpportunityApplication, OpportunityApplicationDraft, Opportunity, Artwork, CreativeWork, PipelineConfig } from "@/types/database";
import type { ApplyModalProps } from "@/components/opportunities/ApplyModal";
import { UploadHighResButton } from "./UploadHighResButton";
import { sendRejectionReplyAction } from "@/app/dashboard/payment-actions";

const DocumentationSubmitter = dynamic(
  () => import("@/components/studio/DocumentationSubmitter").then((m) => m.DocumentationSubmitter),
  { ssr: false }
);

const ApplyModal = dynamic(() => import("@/components/opportunities/ApplyModal").then((m) => m.ApplyModal), { ssr: false });

const PaymentRequestModal = dynamic(
  () => import("@/components/dashboard/PaymentRequestModal").then((m) => m.PaymentRequestModal),
  { ssr: false }
);

interface ApplicationWithOpportunity extends OpportunityApplication {
  documentation?: Record<string, string> | null;
  opportunity: {
    id: string;
    slug: string | null;
    title: string;
    organiser: string;
    type: string;
    deadline: string | null;
    profile_id: string | null;
    pipeline_config: PipelineConfig | null;
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
  artistWorks: CreativeWork[];
  badges: ApplyModalProps["badges"];
  professionalCvUrl: string | null;
}

interface PaymentModalState {
  applicationId: string;
  prefillName: string;
  prefillGstRegistered: boolean;
  prefillGstNumber: string | null;
}

interface Props {
  initialApplications: ApplicationWithOpportunity[];
  userId: string;
  initialDrafts?: DraftWithOpportunity[];
  artistName?: string | null;
  artistGstRegistered?: boolean;
  artistGstNumber?: string | null;
}

export function ApplicationsTab({ initialApplications, userId, initialDrafts = [], artistName, artistGstRegistered = false, artistGstNumber = null }: Props) {
  const [applications, setApplications] = useState(initialApplications);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null);
  // Per-application reply state: appId → { text, confirming, sending, sent }
  const [replyState, setReplyState] = useState<Record<string, { text: string; confirming: boolean; sending: boolean; sent: boolean }>>({});

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

    const [profileResult, worksResult, artworkBadgeResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      isJob
        ? Promise.resolve({ data: [] as CreativeWork[] })
        : supabase.from("creative_works").select("id, profile_id, content_type, title, caption, image_url, audio_url, video_url, text_content, embed_url, embed_provider, year_created, position").eq("profile_id", user.id).order("position", { ascending: true }),
      isJob
        ? Promise.resolve({ data: [] as { current_owner_id: string; creator_id: string }[] })
        : supabase.from("artworks").select("current_owner_id, creator_id").eq("profile_id", user.id),
    ]);

    const profile = profileResult.data;
    const artistWorks = (worksResult.data ?? []) as CreativeWork[];
    const artworksBadge = (artworkBadgeResult.data ?? []) as { current_owner_id: string; creator_id: string }[];

    if (!profile) { setLoadingDraftId(null); return; }

    const badges = computeBadges(
      { ...profile, received_grants: profile.received_grants ?? [] },
      artistWorks.length,
      artworksBadge.some((a) => a.current_owner_id !== a.creator_id)
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
        creative_work_id: draft.creative_work_id ?? null,
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
      artistWorks,
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

                {/* Rejection reason + artist reply */}
                {app.status === "rejected" && (() => {
                  const reason = (app as unknown as { rejection_reason?: string | null }).rejection_reason;
                  const replySentAt = (app as unknown as { rejection_reply_sent_at?: string | null }).rejection_reply_sent_at;
                  const rs = replyState[app.id] ?? { text: "", confirming: false, sending: false, sent: false };
                  return (
                    <div className="mt-2 space-y-2">
                      {reason && (
                        <div className="p-3 bg-stone-50 border border-stone-200 space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-widest text-stone-500">Feedback from organiser</p>
                          <p className="text-xs text-stone-700 whitespace-pre-wrap">{reason}</p>
                        </div>
                      )}
                      {(replySentAt || rs.sent) ? (
                        <p className="text-xs text-muted-foreground">Reply sent.</p>
                      ) : !rs.confirming ? (
                        <button
                          type="button"
                          onClick={() => setReplyState((prev) => ({ ...prev, [app.id]: { ...rs, confirming: true } }))}
                          className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Send a reply →
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={rs.text}
                            onChange={(e) => setReplyState((prev) => ({ ...prev, [app.id]: { ...rs, text: e.target.value } }))}
                            placeholder="Thank you for considering my application…"
                            rows={3}
                            className="w-full text-xs border border-black/30 px-3 py-2 resize-none focus:outline-none focus:border-black"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={rs.sending || !rs.text.trim()}
                              onClick={async () => {
                                setReplyState((prev) => ({ ...prev, [app.id]: { ...rs, sending: true } }));
                                const result = await sendRejectionReplyAction({ applicationId: app.id, message: rs.text });
                                if (result.error) {
                                  setReplyState((prev) => ({ ...prev, [app.id]: { ...rs, sending: false } }));
                                } else {
                                  setReplyState((prev) => ({ ...prev, [app.id]: { text: "", confirming: false, sending: false, sent: true } }));
                                }
                              }}
                              className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              {rs.sending ? "Sending…" : "Send reply →"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyState((prev) => ({ ...prev, [app.id]: { text: "", confirming: false, sending: false, sent: false } }))}
                              className="text-xs border border-black/30 px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Payment request — production_ready */}
                {app.status === "production_ready" && (() => {
                  const invoicePaidAt = (app as unknown as { invoice_paid_at?: string | null }).invoice_paid_at;
                  const invoiceRequestedAt = (app as unknown as { invoice_requested_at?: string | null }).invoice_requested_at;
                  const invoiceAmount = (app as unknown as { invoice_amount?: number | null }).invoice_amount;
                  return (
                    <div className="mt-2 pt-2 border-t border-stone-100">
                      {invoicePaidAt ? (
                        <p className="text-xs text-green-700">
                          Payment confirmed {new Date(invoicePaidAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      ) : invoiceRequestedAt ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            Payment request sent {new Date(invoiceRequestedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                            {invoiceAmount ? ` — NZD ${invoiceAmount.toFixed(2)}` : ""}
                          </p>
                          <button
                            type="button"
                            onClick={() => setPaymentModal({ applicationId: app.id, prefillName: artistName ?? "", prefillGstRegistered: artistGstRegistered, prefillGstNumber: artistGstNumber })}
                            className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Re-send →
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPaymentModal({ applicationId: app.id, prefillName: artistName ?? "", prefillGstRegistered: artistGstRegistered, prefillGstNumber: artistGstNumber })}
                          className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
                        >
                          Request payment →
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Documentation submission — shown when partner requires it and app is selected/approved */}
                {(app.status === "selected" || app.status === "approved_pending_assets" || app.status === "production_ready") &&
                  opp?.pipeline_config?.post_selection?.requires_documentation &&
                  (opp.pipeline_config.post_selection.doc_fields?.length ?? 0) > 0 && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                      <p className="text-xs font-medium text-stone-700">Documentation required</p>
                      <DocumentationSubmitter
                        applicationId={app.id}
                        fields={opp.pipeline_config.post_selection.doc_fields}
                        initial={(app.documentation as Record<string, string>) ?? {}}
                      />
                    </div>
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
          artistWorks={modalState.artistWorks}
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

      {/* Payment request modal */}
      {paymentModal && (
        <PaymentRequestModal
          applicationId={paymentModal.applicationId}
          prefillName={paymentModal.prefillName}
          prefillGstRegistered={paymentModal.prefillGstRegistered}
          prefillGstNumber={paymentModal.prefillGstNumber}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => {
            setPaymentModal(null);
            setApplications((prev) =>
              prev.map((app) =>
                app.id === paymentModal.applicationId
                  ? { ...app, invoice_requested_at: new Date().toISOString() }
                  : app
              )
            );
          }}
        />
      )}
    </div>
  );
}
