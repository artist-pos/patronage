"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { computeBadges } from "@/lib/badges";
import { updateApplicationStatus, getSignedAssetUrl, markInvoicePaid } from "@/app/partner/dashboard/actions";
import { RubricScoringPanel } from "@/components/partner/scoring/RubricScoringPanel";
import type { CustomField, PipelineConfig } from "@/types/database";

interface Artist {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  medium: string[] | null;
  career_stage: string | null;
  city: string | null;
  country: string | null;
  cv_url: string | null;
  exhibition_history: Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }> | null;
  received_grants: string[] | null;
  is_patronage_supported: boolean;
}

interface Artwork {
  id: string;
  url: string;
  caption: string | null;
}

interface StatusLogEntry {
  id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  changed_by_name: string | null;
}

interface Application {
  id: string;
  status: string;
  created_at: string;
  custom_answers: Record<string, string>;
  highres_asset_url: string | null;
  submitted_image_url: string | null;
  documentation: Record<string, string> | null;
  artist: Artist | null;
  artwork: Artwork | null;
  invoice_requested_at: string | null;
  invoice_amount: number | null;
  invoice_paid_at: string | null;
  status_log?: StatusLogEntry[];
}

interface Opportunity {
  id: string;
  title: string;
  type?: string;
  custom_fields: CustomField[];
  show_badges_in_submission: boolean;
  pipeline_config?: PipelineConfig | null;
}

interface Props {
  application: Application;
  opportunity: Opportunity;
  closeUrl: string;
  onClose?: () => void;
}

const STATUS_OPTIONS = [
  { val: "pending", label: "New" },
  { val: "shortlisted", label: "Shortlist" },
  { val: "selected", label: "Select" },
  { val: "approved_pending_assets", label: "Approve" },
  { val: "production_ready", label: "Production Ready" },
  { val: "rejected", label: "Reject" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "New",
  shortlisted: "Shortlisted",
  selected: "Selected",
  approved_pending_assets: "Awaiting File",
  production_ready: "Download Ready",
  rejected: "Rejected",
};

export function ApplicantPanel({ application, opportunity, closeUrl, onClose }: Props) {
  const router = useRouter();

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      router.push(closeUrl);
      router.refresh();
    }
  }
  const [status, setStatus] = useState(application.status);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastIsUndo, setToastIsUndo] = useState(false);
  const [undoStatus, setUndoStatus] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [confirmAction, setConfirmAction] = useState<typeof STATUS_OPTIONS[number] | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const artist = application.artist;
  const displayName = artist?.full_name ?? artist?.username ?? "Unknown";
  const exhibitionCount = (artist?.exhibition_history ?? []).length;

  const badges = artist
    ? computeBadges(
        {
          is_patronage_supported: artist.is_patronage_supported,
          bio: artist.bio,
          avatar_url: artist.avatar_url,
          exhibition_history: artist.exhibition_history ?? [],
          received_grants: artist.received_grants ?? [],
        },
        0, // works count not critical here
        false
      )
    : null;

  async function applyStatusChange(newStatus: typeof STATUS_OPTIONS[number]["val"], reason?: string) {
    const previousStatus = status;
    setSaving(true);
    const result = await updateApplicationStatus(application.id, newStatus, reason || undefined);
    setSaving(false);
    if (result.error) {
      setToast("Error: " + result.error);
      setToastIsUndo(false);
      setTimeout(() => setToast(null), 3000);
    } else {
      setStatus(newStatus);
      setUndoStatus(previousStatus);
      setToastIsUndo(true);
      setToast(`Status set to ${STATUS_LABELS[newStatus] ?? newStatus}`);
      // Clear any existing undo timer
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setToast(null);
        setToastIsUndo(false);
        setUndoStatus(null);
      }, 5000);
    }
  }

  function handleStatusChange(opt: typeof STATUS_OPTIONS[number]) {
    // Confirm destructive/significant actions
    if (opt.val === "rejected" || opt.val === "selected") {
      setConfirmAction(opt);
    } else {
      applyStatusChange(opt.val);
    }
  }

  async function handleUndo() {
    if (!undoStatus) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setToast(null);
    setToastIsUndo(false);
    await applyStatusChange(undoStatus as typeof STATUS_OPTIONS[number]["val"]);
    setUndoStatus(null);
  }

  async function handleDownload() {
    setLoadingDownload(true);
    const result = await getSignedAssetUrl(application.id);
    setLoadingDownload(false);
    if (result.url) {
      setSignedUrl(result.url);
      window.open(result.url, "_blank");
    } else {
      setToast("Error: " + result.error);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-background border border-black w-full max-w-lg max-h-[85vh] overflow-y-auto sm:max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black sticky top-0 bg-background z-10">
          <div>
            <h2 className="text-sm font-semibold">{displayName}</h2>
            <p className="text-xs text-muted-foreground">
              Applied {new Date(application.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground hover:opacity-70 transition-opacity p-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Artist profile */}
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              {artist?.avatar_url && (
                <div className="relative w-16 h-16 shrink-0 border border-black overflow-hidden">
                  <Image src={artist.avatar_url} alt={displayName} fill className="object-cover" sizes="64px" />
                </div>
              )}
              <div className="space-y-1 min-w-0">
                <p className="font-semibold">{displayName}</p>
                {artist?.career_stage && (
                  <p className="text-xs text-muted-foreground">
                    {[artist.career_stage, [artist.city, artist.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </p>
                )}
                {(artist?.medium ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(artist?.medium ?? []).slice(0, 3).map((m: string) => (
                      <span key={m} className="text-xs border border-black px-1.5 py-0.5 leading-none">{m}</span>
                    ))}
                  </div>
                )}
                {exhibitionCount > 0 && (
                  <p className="text-xs text-muted-foreground">{exhibitionCount} exhibition{exhibitionCount !== 1 ? "s" : ""}</p>
                )}
                <div className="flex flex-wrap gap-3 pt-0.5">
                  <Link
                    href={`/${artist?.username}`}
                    target="_blank"
                    className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View profile →
                  </Link>
                  {artist?.cv_url && (
                    <a
                      href={artist.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Download CV →
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Badges */}
            {opportunity.show_badges_in_submission && badges && (
              <div className="flex flex-wrap gap-1.5">
                {badges.withPatronage && (
                  <span className="text-xs bg-black text-white px-2 py-0.5 leading-none">With Patronage</span>
                )}
                {badges.verified && <span className="text-xs border border-black/50 text-muted-foreground px-2 py-0.5 leading-none">Verified</span>}
                {badges.exhibited && <span className="text-xs border border-black/50 text-muted-foreground px-2 py-0.5 leading-none">Exhibited</span>}
                {badges.grantRecipient && <span className="text-xs border border-black/50 text-muted-foreground px-2 py-0.5 leading-none">Grant Recipient</span>}
                {badges.collected && <span className="text-xs border border-black/50 text-muted-foreground px-2 py-0.5 leading-none">Collected</span>}
              </div>
            )}

            {artist?.bio && (
              <p className="text-sm leading-relaxed text-muted-foreground">{artist.bio}</p>
            )}
          </div>

          {/* Submitted artwork / CV */}
          {opportunity.type === "Job / Employment" ? (
            application.submitted_image_url && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest">Professional CV</p>
                <a
                  href={application.submitted_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Download CV →
                </a>
              </div>
            )
          ) : (
            (application.artwork || application.submitted_image_url) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest">Submitted Work</p>
                <div className="border border-black overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={application.artwork?.url ?? application.submitted_image_url!}
                    alt={application.artwork?.caption ?? "Submitted image"}
                    className="w-full max-h-64 object-contain bg-muted"
                  />
                  {application.artwork?.caption && (
                    <p className="text-xs text-muted-foreground p-2">{application.artwork.caption}</p>
                  )}
                </div>
              </div>
            )
          )}

          {/* Custom answers — supports both pipeline_config.questions (new) and custom_fields (legacy) */}
          {(() => {
            const normalisedFields = opportunity.pipeline_config?.questions?.length
              ? opportunity.pipeline_config.questions.map((q) => ({
                  id: q.id,
                  label: q.label,
                  isFile: q.type === "file_upload",
                }))
              : (opportunity.custom_fields ?? []).map((f) => ({
                  id: f.id,
                  label: f.question,
                  isFile: f.inputType === "file",
                }));
            if (normalisedFields.length === 0) return null;
            return (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest">Application Answers</p>
                {normalisedFields.map((field) => {
                  const answer = application.custom_answers?.[field.id];
                  if (!answer) return null;
                  if (field.isFile) {
                    // Parse as JSON array (new format) or fall back to single URL (old format)
                    let urls: string[] = [];
                    try {
                      const parsed = JSON.parse(answer);
                      urls = Array.isArray(parsed) ? parsed : [answer];
                    } catch {
                      urls = [answer];
                    }
                    return (
                      <div key={field.id} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                        <ul className="space-y-1">
                          {urls.map((url, i) => {
                            // Extract filename from storage path
                            const parts = url.split("/");
                            const rawName = parts[parts.length - 1]?.split("?")[0] ?? "";
                            // Strip leading timestamp prefix (e.g. "1234567890-filename.pdf")
                            const displayName = rawName.replace(/^\d+-/, "") || `File ${i + 1}`;
                            return (
                              <li key={url}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm underline underline-offset-2 inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                                  title={displayName}
                                >
                                  {displayName}
                                  {urls.length > 1 && (
                                    <span className="text-xs text-muted-foreground not-underline ml-0.5">→</span>
                                  )}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  }
                  return (
                    <div key={field.id} className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                      <p className="text-sm whitespace-pre-wrap">{answer}</p>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* T&C PDF download */}
          {opportunity.pipeline_config?.terms_pdf_url && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest">Terms &amp; Conditions</p>
              <a
                href={opportunity.pipeline_config.terms_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline underline-offset-2"
              >
                Download PDF →
              </a>
            </div>
          )}

          {/* High-res download */}
          {status === "production_ready" && application.highres_asset_url && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest">Production Asset</p>
              <button
                type="button"
                onClick={handleDownload}
                disabled={loadingDownload}
                className="text-xs border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-50"
              >
                {loadingDownload ? "Generating link…" : "Download High-Res →"}
              </button>
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block text-xs underline">
                  Direct link (1 hour)
                </a>
              )}
            </div>
          )}

          {/* Invoice / payment — production_ready */}
          {status === "production_ready" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest">Payment</p>
              {application.invoice_paid_at ? (
                <p className="text-xs text-muted-foreground">
                  Payment confirmed {new Date(application.invoice_paid_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              ) : application.invoice_requested_at ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Invoice received {new Date(application.invoice_requested_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                    {application.invoice_amount ? ` — NZD ${application.invoice_amount.toFixed(2)}` : ""}
                  </p>
                  <button
                    type="button"
                    disabled={markingPaid}
                    onClick={async () => {
                      setMarkingPaid(true);
                      const result = await markInvoicePaid(application.id);
                      setMarkingPaid(false);
                      if (result.error) {
                        setToast("Error: " + result.error);
                        setToastIsUndo(false);
                        setTimeout(() => setToast(null), 3000);
                      } else {
                        setToast("Payment marked as confirmed");
                        setToastIsUndo(false);
                        setTimeout(() => setToast(null), 4000);
                      }
                    }}
                    className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {markingPaid ? "Saving…" : "Mark as paid →"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Awaiting invoice from artist.</p>
              )}
            </div>
          )}

          {/* Submitted documentation */}
          {opportunity.pipeline_config?.post_selection?.requires_documentation &&
            (opportunity.pipeline_config.post_selection.doc_fields?.length ?? 0) > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest">Documentation</p>
                {application.documentation && Object.keys(application.documentation).length > 0 ? (
                  <div className="space-y-2">
                    {opportunity.pipeline_config.post_selection.doc_fields.map((field) => {
                      const value = application.documentation?.[field.id];
                      if (!value) return null;
                      return (
                        <div key={field.id} className="space-y-0.5">
                          <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                          {field.type === "file" ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm underline underline-offset-2 hover:opacity-70 transition-opacity"
                            >
                              Download file →
                            </a>
                          ) : field.type === "link" ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm underline underline-offset-2 break-all hover:opacity-70 transition-opacity"
                            >
                              {value}
                            </a>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{value}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No documentation submitted yet.</p>
                )}
              </div>
            )}

          {/* Rubric scoring */}
          {(opportunity.pipeline_config?.questions?.length ?? 0) > 0 && (
            <div className="border-t border-black/10 pt-4">
              <RubricScoringPanel
                opportunityId={opportunity.id}
                applicationId={application.id}
              />
            </div>
          )}

          {/* Status actions */}
          <div className="space-y-3 border-t border-black pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest">Status</p>
              <span className="text-xs bg-muted px-2 py-0.5 leading-none">{STATUS_LABELS[status] ?? status}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.filter((o) => o.val !== status).map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => handleStatusChange(opt)}
                  disabled={saving}
                  className={`text-xs px-3 py-1.5 border transition-colors disabled:opacity-50 cursor-pointer ${
                    opt.val === "rejected"
                      ? "border-black/30 text-muted-foreground hover:border-black"
                      : opt.val === "approved_pending_assets"
                      ? "border-black bg-black text-white hover:bg-white hover:text-black"
                      : "border-black hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {toast && (
              <div className={`flex items-center gap-3 text-xs ${toast.startsWith("Error") ? "text-destructive" : "text-green-700"}`}>
                <span>{toast}</span>
                {toastIsUndo && undoStatus && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={saving}
                    className="underline underline-offset-2 text-foreground hover:opacity-70 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    Undo
                  </button>
                )}
              </div>
            )}

            {/* Status history */}
            {(application.status_log ?? []).length > 0 && (
              <div className="pt-2 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer"
                >
                  {showHistory ? "Hide history" : "Show history"}
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {(application.status_log ?? []).map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0 tabular-nums">
                          {new Date(entry.changed_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                        </span>
                        <span>
                          {STATUS_LABELS[entry.old_status] ?? entry.old_status}
                          {" → "}
                          {STATUS_LABELS[entry.new_status] ?? entry.new_status}
                        </span>
                        {entry.changed_by_name && (
                          <span className="text-muted-foreground/60">by {entry.changed_by_name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmAction(null); }}
        >
          <div className="bg-background border border-black w-full max-w-sm p-6 space-y-4">
            <p className="font-semibold text-sm">
              {confirmAction.val === "rejected"
                ? "Reject this application?"
                : "Select this applicant?"}
            </p>
            <p className="text-xs text-muted-foreground">
              {confirmAction.val === "rejected"
                ? "You can reverse this at any time by changing their status."
                : "This will create a verified achievement on their Patronage profile. You can reverse this at any time."}
            </p>
            {confirmAction.val === "rejected" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Reason for not selecting (sent to artist — optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. We had more applications than places available…"
                  rows={3}
                  className="w-full text-xs border border-black/30 px-3 py-2 resize-none focus:outline-none focus:border-black"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const reason = confirmAction.val === "rejected" ? rejectionReason : undefined;
                  setConfirmAction(null);
                  setRejectionReason("");
                  applyStatusChange(confirmAction.val, reason || undefined);
                }}
                disabled={saving}
                className="flex-1 text-xs px-4 py-2 bg-black text-white hover:bg-black/80 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => { setConfirmAction(null); setRejectionReason(""); }}
                className="flex-1 text-xs px-4 py-2 border border-black hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
