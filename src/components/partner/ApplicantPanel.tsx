"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { computeBadges } from "@/lib/badges";
import { updateApplicationStatus, getSignedAssetUrl } from "@/app/partner/dashboard/actions";
import type { CustomField, PipelineConfig } from "@/types/database";

interface Artist {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  medium: string[] | null;
  career_stage: string | null;
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

interface Application {
  id: string;
  status: string;
  created_at: string;
  custom_answers: Record<string, string>;
  highres_asset_url: string | null;
  submitted_image_url: string | null;
  artist: Artist | null;
  artwork: Artwork | null;
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
}

const STATUS_OPTIONS = [
  { val: "pending", label: "New" },
  { val: "shortlisted", label: "Shortlist" },
  { val: "selected", label: "Select" },
  { val: "approved_pending_assets", label: "Approve" },
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

export function ApplicantPanel({ application, opportunity, closeUrl }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(application.status);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingDownload, setLoadingDownload] = useState(false);

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

  async function handleStatusChange(newStatus: typeof STATUS_OPTIONS[number]["val"]) {
    setSaving(true);
    const result = await updateApplicationStatus(application.id, newStatus);
    if (result.error) {
      setToast("Error: " + result.error);
    } else {
      setStatus(newStatus);
      setToast("Updated");
    }
    setSaving(false);
    setTimeout(() => setToast(null), 2000);
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
      onClick={(e) => { if (e.target === e.currentTarget) void e; }}
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
            onClick={() => { router.push(closeUrl); router.refresh(); }}
            className="text-muted-foreground hover:text-foreground"
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
                    {[artist.career_stage, artist.country].filter(Boolean).join(" · ")}
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
                  onClick={() => handleStatusChange(opt.val)}
                  disabled={saving}
                  className={`text-xs px-3 py-1.5 border transition-colors disabled:opacity-50 ${
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
              <p className={`text-xs ${toast === "Updated" ? "text-green-600" : "text-destructive"}`}>
                {toast}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
