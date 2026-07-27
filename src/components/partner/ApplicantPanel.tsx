"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, Music, Play, FileText, Link as LinkIcon } from "lucide-react";
import { computeBadges } from "@/lib/badges";
import { updateApplicationStatus, getSignedAssetUrl, markInvoicePaid } from "@/app/partner/dashboard/actions";
import { RubricScoringPanel } from "@/components/partner/scoring/RubricScoringPanel";
import type { CustomField, PipelineConfig } from "@/types/database";
import type { EnrichedApp, CreativeWorkLite } from "./ApplicationsManager";
import { getStages, getStagesWithOccupied, stageLabel } from "@/lib/pipeline-stages";

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
  creative_works: CreativeWorkLite[] | null;
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
  allApps?: EnrichedApp[];
  onNavigate?: (id: string) => void;
}

type AppTab = "application" | "portfolio" | "cv" | "activity";

export function ApplicantPanel({ application, opportunity, onClose, allApps, onNavigate }: Props) {
  const [status, setStatus] = useState(application.status);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastIsUndo, setToastIsUndo] = useState(false);
  const [undoStatus, setUndoStatus] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ val: string; label: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [appTab, setAppTab] = useState<AppTab>("application");

  const stagesCfg = opportunity.pipeline_config?.pipeline_stages ?? null;
  const enabledStageVals = new Set(getStages(stagesCfg).map((s) => s.val));
  const currentStageDot = getStagesWithOccupied(stagesCfg, [{ status }]).find((s) => s.val === status)?.dot ?? "bg-stone-300";

  const artist = application.artist;
  const displayName = artist?.full_name ?? artist?.username ?? "Unknown";
  const creativeWorksList = application.creative_works ?? [];
  const artworkImages = application.artwork ? [application.artwork] : [];
  // Legacy fallback — pre-multi-pick applications only ever stored one flattened
  // image with no artwork/creative_works rows to point to.
  const legacyImage =
    artworkImages.length === 0 && creativeWorksList.length === 0 && application.submitted_image_url
      ? [{ id: "si", url: application.submitted_image_url, caption: null }]
      : [];
  const portfolioIsEmpty = artworkImages.length === 0 && creativeWorksList.length === 0 && legacyImage.length === 0;
  const exhibitionHistory = artist?.exhibition_history ?? [];
  const badges = artist
    ? computeBadges({ is_patronage_supported: artist.is_patronage_supported, bio: artist.bio, avatar_url: artist.avatar_url, exhibition_history: artist.exhibition_history ?? [], received_grants: artist.received_grants ?? [] }, 0, false)
    : null;

  // Navigation
  const currentIdx = allApps?.findIndex((a) => a.id === application.id) ?? -1;
  const prevApp = currentIdx > 0 ? allApps?.[currentIdx - 1] : null;
  const nextApp = allApps && currentIdx < allApps.length - 1 ? allApps[currentIdx + 1] : null;

  async function applyStatusChange(newStatus: string, reason?: string) {
    const previousStatus = status;
    setSaving(true);
    const result = await updateApplicationStatus(application.id, newStatus as Parameters<typeof updateApplicationStatus>[1], reason);
    setSaving(false);
    if (result.error) {
      setToast("Error: " + result.error);
      setToastIsUndo(false);
      setTimeout(() => setToast(null), 3000);
    } else {
      setStatus(newStatus);
      setUndoStatus(previousStatus);
      setToastIsUndo(true);
      setToast(`Moved to ${stageLabel(newStatus, stagesCfg)}`);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => { setToast(null); setToastIsUndo(false); setUndoStatus(null); }, 5000);
    }
  }

  async function handleDownload() {
    setLoadingDownload(true);
    const result = await getSignedAssetUrl(application.id);
    setLoadingDownload(false);
    if (result.url) { setSignedUrl(result.url); window.open(result.url, "_blank"); }
    else { setToast("Error: " + result.error); setTimeout(() => setToast(null), 3000); }
  }

  // Normalised questions
  const questions = opportunity.pipeline_config?.questions?.length
    ? opportunity.pipeline_config.questions.map((q) => ({ id: q.id, label: q.label, isFile: q.type === "file_upload" }))
    : (opportunity.custom_fields ?? []).map((f) => ({ id: f.id, label: f.question, isFile: f.inputType === "file" }));

  const initials = displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>

      {/* ── Left: scrollable content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-black/10 shrink-0">
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <button type="button" onClick={onClose} className="hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
            <span>{opportunity.title}</span>
            {allApps && <span>Application {currentIdx + 1} of {allApps.length}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!prevApp} onClick={() => prevApp && onNavigate?.(prevApp.id)}
              className="p-1.5 border border-black/10 hover:border-black transition-colors disabled:opacity-30">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" disabled={!nextApp} onClick={() => nextApp && onNavigate?.(nextApp.id)}
              className="p-1.5 border border-black/10 hover:border-black transition-colors disabled:opacity-30">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Artist header */}
        <div className="px-6 py-5 border-b border-black/10 shrink-0">
          <div className="flex items-start gap-4">
            {artist?.avatar_url ? (
              <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border border-black/10">
                <Image src={artist.avatar_url} alt={displayName} fill className="object-cover" sizes="56px" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-stone-700 text-white flex items-center justify-center text-lg font-semibold shrink-0">
                {initials}
              </div>
            )}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {artist?.career_stage && <span className="text-xs border border-black/20 px-2 py-0.5 text-stone-500">{artist.career_stage}</span>}
                {(artist?.medium ?? []).slice(0, 2).map((m: string) => (
                  <span key={m} className="text-xs border border-black/20 px-2 py-0.5 text-stone-500">{m}</span>
                ))}
              </div>
              <h2 className="text-xl font-semibold">{displayName}</h2>
              <div className="flex items-center gap-3 text-xs text-stone-400 flex-wrap">
                {[artist?.city, artist?.country].filter(Boolean).join(", ") && (
                  <span>{[artist?.city, artist?.country].filter(Boolean).join(", ")}</span>
                )}
                {artist?.username && <span>@{artist.username}</span>}
                <Link href={`/${artist?.username}`} target="_blank"
                  className="hover:text-foreground transition-colors flex items-center gap-0.5">
                  View public profile ↗
                </Link>
              </div>
              {opportunity.show_badges_in_submission && badges && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {badges.withPatronage && <span className="text-[10px] bg-black text-white px-2 py-0.5">With Patronage</span>}
                  {badges.verified && <span className="text-[10px] border border-black/20 text-stone-500 px-2 py-0.5">Verified</span>}
                  {badges.exhibited && <span className="text-[10px] border border-black/20 text-stone-500 px-2 py-0.5">Exhibited</span>}
                  {badges.grantRecipient && <span className="text-[10px] border border-black/20 text-stone-500 px-2 py-0.5">Grant Recipient</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-black/10 shrink-0 px-2">
          {([
            { id: "application", label: "Application" },
            { id: "portfolio", label: `Portfolio${!portfolioIsEmpty ? ` · ${artworkImages.length + creativeWorksList.length + legacyImage.length}` : ""}` },
            { id: "cv", label: "CV" },
            { id: "activity", label: "Activity" },
          ] as { id: AppTab; label: string }[]).map((t) => (
            <button key={t.id} type="button" onClick={() => setAppTab(t.id)}
              className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${appTab === t.id ? "border-black text-foreground font-medium" : "border-transparent text-stone-400 hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1 px-6 py-6 space-y-6">

          {/* ─ Application tab ─ */}
          {appTab === "application" && (
            <>
              {questions.length === 0 && artist?.bio && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Practice</p>
                  <p className="text-sm leading-relaxed">{artist.bio}</p>
                </div>
              )}
              {questions.map((field) => {
                const answer = application.custom_answers?.[field.id];
                if (!answer) return null;
                if (field.isFile) {
                  let urls: string[] = [];
                  try { const p = JSON.parse(answer); urls = Array.isArray(p) ? p : [answer]; }
                  catch { urls = [answer]; }
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{field.label}</p>
                      <ul className="space-y-1">
                        {urls.map((url, i) => {
                          const parts = url.split("/"); const raw = parts[parts.length - 1]?.split("?")[0] ?? "";
                          const name = raw.replace(/^\d+-/, "") || `File ${i + 1}`;
                          return (
                            <li key={url}><a href={url} target="_blank" rel="noopener noreferrer"
                              className="text-sm underline underline-offset-2 hover:opacity-70 transition-opacity">{name}</a></li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                }
                return (
                  <div key={field.id} className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{field.label}</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
                  </div>
                );
              })}
              {opportunity.pipeline_config?.terms_pdf_url && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Terms accepted</p>
                  <a href={opportunity.pipeline_config.terms_pdf_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs underline underline-offset-2">View T&C PDF →</a>
                </div>
              )}
              {questions.length === 0 && !artist?.bio && (
                <p className="text-sm text-stone-400">No application answers.</p>
              )}
            </>
          )}

          {/* ─ Portfolio tab ─ */}
          {appTab === "portfolio" && (
            <>
              {!portfolioIsEmpty ? (
                <div className="grid grid-cols-2 gap-3">
                  {artworkImages.map((img) => (
                    <div key={img.id} className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-stone-400">For sale</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.caption ?? ""} className="w-full object-contain bg-stone-50 border border-black/10" style={{ maxHeight: 200 }} />
                      {img.caption && <p className="text-xs text-stone-400">{img.caption}</p>}
                    </div>
                  ))}
                  {creativeWorksList.map((work) => (
                    <div key={work.id} className="space-y-1">
                      {work.content_type === "image" && work.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={work.image_url} alt={work.caption ?? ""} className="w-full object-contain bg-stone-50 border border-black/10" style={{ maxHeight: 200 }} />
                      ) : (
                        <div className="w-full h-[200px] flex flex-col items-center justify-center gap-2 bg-stone-50 border border-black/10">
                          {work.content_type === "audio" ? <Music className="w-6 h-6 text-stone-400" />
                            : work.content_type === "video" ? <Play className="w-6 h-6 text-stone-400" />
                            : work.content_type === "text" ? <FileText className="w-6 h-6 text-stone-400" />
                            : <LinkIcon className="w-6 h-6 text-stone-400" />}
                          <span className="text-xs text-stone-400 capitalize">{work.content_type}</span>
                        </div>
                      )}
                      <p className="text-xs text-stone-400">{work.title ?? work.caption ?? ""}</p>
                    </div>
                  ))}
                  {legacyImage.map((img) => (
                    <div key={img.id} className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.caption ?? ""} className="w-full object-contain bg-stone-50 border border-black/10" style={{ maxHeight: 200 }} />
                      {img.caption && <p className="text-xs text-stone-400">{img.caption}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400">No portfolio images submitted.</p>
              )}
              {status === "production_ready" && application.highres_asset_url && (
                <div className="border-t border-black/10 pt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Production Asset</p>
                  <button type="button" onClick={handleDownload} disabled={loadingDownload}
                    className="text-xs border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-50">
                    {loadingDownload ? "Generating link…" : "Download High-Res →"}
                  </button>
                  {signedUrl && <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block text-xs underline">Direct link (1 hour)</a>}
                </div>
              )}
            </>
          )}

          {/* ─ CV tab ─ */}
          {appTab === "cv" && (
            <>
              {artist?.cv_url && (
                <a href={artist.cv_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm border border-black px-4 py-2 hover:bg-muted transition-colors">
                  Download CV PDF →
                </a>
              )}
              {exhibitionHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Exhibitions</p>
                  <div className="divide-y divide-black/5">
                    {exhibitionHistory.map((ex, i) => (
                      <div key={i} className="py-2.5 grid grid-cols-[80px_1fr] gap-4 text-sm">
                        <span className="text-stone-400 tabular-nums">{ex.year}</span>
                        <div>
                          <span className="text-[10px] border border-black/20 px-1.5 py-0.5 mr-2 text-stone-500">{ex.type}</span>
                          <span className="font-medium">{ex.title}</span>
                          <span className="text-stone-400"> · {ex.venue}{ex.location ? `, ${ex.location}` : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(artist?.received_grants ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Grants received</p>
                  <ul className="space-y-1">
                    {(artist?.received_grants ?? []).map((g: string, i: number) => (
                      <li key={i} className="text-sm text-stone-600">— {g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!artist?.cv_url && exhibitionHistory.length === 0 && (
                <p className="text-sm text-stone-400">No CV information available.</p>
              )}
            </>
          )}

          {/* ─ Activity tab ─ */}
          {appTab === "activity" && (
            <>
              <div className="space-y-1">
                <p className="text-xs text-stone-400">Applied {new Date(application.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              {(application.status_log ?? []).length > 0 ? (
                <div className="space-y-2">
                  {(application.status_log ?? []).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm">
                      <span className="text-stone-300 tabular-nums text-xs mt-0.5 shrink-0">
                        {new Date(entry.changed_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                      </span>
                      <span className="text-stone-600">
                        {stageLabel(entry.old_status, stagesCfg)} → {stageLabel(entry.new_status, stagesCfg)}
                      </span>
                      {entry.changed_by_name && <span className="text-stone-400 text-xs">by {entry.changed_by_name}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400">No status changes recorded.</p>
              )}
              {/* Invoice / payment */}
              {status === "production_ready" && (
                <div className="border-t border-black/10 pt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Payment</p>
                  {application.invoice_paid_at ? (
                    <p className="text-xs text-stone-500">Payment confirmed {new Date(application.invoice_paid_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</p>
                  ) : application.invoice_requested_at ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-stone-500">Invoice received {new Date(application.invoice_requested_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}{application.invoice_amount ? ` — NZD ${application.invoice_amount.toFixed(2)}` : ""}</p>
                      <button type="button" disabled={markingPaid}
                        onClick={async () => {
                          setMarkingPaid(true);
                          const r = await markInvoicePaid(application.id);
                          setMarkingPaid(false);
                          if (r.error) { setToast("Error: " + r.error); } else { setToast("Payment confirmed"); }
                          setTimeout(() => setToast(null), 4000);
                        }}
                        className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50">
                        {markingPaid ? "Saving…" : "Mark as paid →"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">Awaiting invoice from artist.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right: decision panel ── */}
      <div className="w-72 border-l border-black/10 flex flex-col bg-stone-50/30 overflow-y-auto shrink-0">
        <div className="p-5 space-y-5 flex-1">

          {/* Decision */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Decision</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${currentStageDot}`} />
              <span className="text-sm font-medium">{stageLabel(status, stagesCfg)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { val: "shortlisted", label: "Shortlist" },
                { val: "selected", label: "Select" },
                { val: "approved_pending_assets", label: "Send to inbox" },
                { val: "rejected", label: "Reject" },
              ].filter((opt) => (enabledStageVals as Set<string>).has(opt.val)).map((opt) => (
                <button key={opt.val} type="button"
                  disabled={saving || status === opt.val}
                  onClick={() => {
                    if (opt.val === "rejected" || opt.val === "selected") {
                      setConfirmAction(opt);
                    } else {
                      applyStatusChange(opt.val);
                    }
                  }}
                  className={`text-xs px-3 py-2 border transition-colors disabled:opacity-40 ${
                    opt.val === "rejected"
                      ? "border-red-200 text-red-600 hover:bg-red-50"
                      : opt.val === "selected"
                      ? "border-black bg-black text-white hover:bg-black/80"
                      : "border-black/20 hover:border-black hover:bg-white"
                  } ${status === opt.val ? "opacity-40 cursor-default" : "cursor-pointer"}`}>
                  {opt.val === "rejected" ? "× " : opt.val === "selected" ? "✓ " : ""}{opt.label}
                </button>
              ))}
            </div>
            {toast && (
              <div className={`text-xs flex items-center gap-2 ${toast.startsWith("Error") ? "text-red-500" : "text-emerald-600"}`}>
                <span>{toast}</span>
                {toastIsUndo && undoStatus && (
                  <button type="button" onClick={async () => {
                    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                    setToast(null);
                    await applyStatusChange(undoStatus);
                    setUndoStatus(null);
                  }} className="underline cursor-pointer">Undo</button>
                )}
              </div>
            )}
          </div>

          {/* Rubric scoring */}
          {(opportunity.pipeline_config?.questions?.length ?? 0) > 0 && (
            <div className="space-y-3 border-t border-black/10 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Your scoring</p>
              <RubricScoringPanel opportunityId={opportunity.id} applicationId={application.id} compact />
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 border-t border-black/10 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Actions</p>
            <Link href={`/messages`} className="flex items-center gap-2 text-xs px-3 py-2 border border-black/15 hover:border-black transition-colors w-full">
              <span>Message {artist?.full_name?.split(" ")[0] ?? "artist"}</span>
            </Link>
            <button type="button" onClick={() => exportPDF()}
              className="flex items-center gap-2 text-xs px-3 py-2 border border-black/15 hover:border-black transition-colors w-full text-left">
              Download as PDF
            </button>
            {artist?.cv_url && (
              <a href={artist.cv_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs px-3 py-2 border border-black/15 hover:border-black transition-colors">
                Download CV
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 z-10">
          <div className="bg-background border border-black/10 shadow-xl w-full max-w-sm p-6 space-y-4">
            <p className="font-semibold">{confirmAction.val === "rejected" ? "Reject this application?" : "Select this applicant?"}</p>
            <p className="text-sm text-stone-500">
              {confirmAction.val === "rejected"
                ? "You can reverse this at any time by changing their status."
                : "This will create a verified achievement on their Patronage profile."}
            </p>
            {confirmAction.val === "rejected" && (
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for not selecting (sent to artist — optional)"
                rows={3} className="w-full text-sm border border-black/20 px-3 py-2 resize-none focus:outline-none focus:border-black" />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => { const r = confirmAction.val === "rejected" ? rejectionReason : undefined; setConfirmAction(null); setRejectionReason(""); applyStatusChange(confirmAction.val, r); }}
                disabled={saving}
                className="flex-1 text-sm px-4 py-2 bg-black text-white hover:bg-black/80 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Confirm"}
              </button>
              <button type="button" onClick={() => { setConfirmAction(null); setRejectionReason(""); }}
                className="flex-1 text-sm px-4 py-2 border border-black/20 hover:border-black transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function exportPDF() {
  window.print();
}
