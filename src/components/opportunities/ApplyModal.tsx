"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, Upload, Music, Play, FileText, Link, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitApplication, saveDraft } from "@/app/opportunities/[id]/actions";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import type { CreativeWork, OpportunityApplicationDraft } from "@/types/database";
import type { OpportunityForApply, AvailableWork } from "./ApplyButton";
import type { BadgeSet } from "@/lib/badges";

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

// Full listing details for reference while writing — desktop sidebar, mobile accordion.
function ListingReference({ opportunity: o }: { opportunity: OpportunityForApply }) {
  const fundingLabel = o.funding_range?.trim() || (o.funding_amount != null ? formatFunding(o.funding_amount) : null);
  const deadline = fmtDate(o.deadline);
  const opensAt = fmtDate(o.opens_at);
  const location = o.city ? `${o.city}, ${o.country ?? ""}`.replace(/, $/, "") : o.country;
  const bodyText = o.full_description ?? o.caption ?? null;
  const hasStats = !!(fundingLabel || deadline || opensAt || o.entry_fee != null || o.artist_payment_type || o.travel_support != null);

  return (
    <div className="p-5 space-y-4">
      {o.featured_image_url && (
        <div className="border border-black overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.featured_image_url} alt={o.title} className="w-full max-h-40 object-contain" />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] border border-black px-1.5 py-0.5 leading-none">{o.type}</span>
          {o.country && <span className="text-[10px] border border-black px-1.5 py-0.5 leading-none">{o.country}</span>}
        </div>
        <h3 className="font-semibold leading-snug">{o.title}</h3>
        <p className="text-xs text-muted-foreground">{o.organiser}</p>
      </div>

      {(o.sub_categories ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(o.sub_categories ?? []).map((cat) => (
            <span key={cat} className="text-[10px] border border-black/30 text-muted-foreground px-1.5 py-0.5 leading-none">{cat}</span>
          ))}
        </div>
      )}

      {hasStats && (
        <div className="grid grid-cols-2 gap-3 border-t border-black/10 pt-3">
          {fundingLabel && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Funding</p>
              <p className="text-xs font-medium">{fundingLabel}</p>
            </div>
          )}
          {deadline && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Deadline</p>
              <p className="text-xs font-medium">{deadline}</p>
            </div>
          )}
          {opensAt && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Opens</p>
              <p className="text-xs font-medium">{opensAt}</p>
            </div>
          )}
          {location && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Location</p>
              <p className="text-xs font-medium">{location}</p>
            </div>
          )}
          {o.entry_fee != null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Entry Fee</p>
              <p className="text-xs font-medium">{o.entry_fee === 0 ? "Free" : `NZD ${o.entry_fee}`}</p>
            </div>
          )}
          {o.artist_payment_type && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Artist Payment</p>
              <p className="text-xs font-medium">{o.artist_payment_type}</p>
            </div>
          )}
          {o.travel_support != null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Travel Support</p>
              <p className="text-xs font-medium">{o.travel_support ? "Yes" : "No"}</p>
            </div>
          )}
        </div>
      )}

      {bodyText && (
        <div className="border-t border-black/10 pt-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">About</p>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{bodyText}</p>
        </div>
      )}
    </div>
  );
}

interface ArtistProfile {
  id: string;
  full_name: string | null;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  medium: string[] | null;
  exhibition_history: Array<{ type: string }>;
}

export interface ApplyModalProps {
  opportunity: OpportunityForApply;
  artistProfile: ArtistProfile;
  artistWorks: CreativeWork[];
  availableWorks: AvailableWork[];
  badges: BadgeSet | null;
  isJobOpportunity?: boolean;
  professionalCvUrl?: string | null;
  draft?: OpportunityApplicationDraft | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Props = ApplyModalProps;

// Normalise pipeline_config.questions or custom_fields into a single shape
interface NormalisedField {
  id: string;
  label: string;
  type: "short" | "long" | "file";
  file_label?: string;
}

function normaliseFields(opp: OpportunityForApply): NormalisedField[] {
  if (opp.pipeline_config?.questions?.length) {
    return opp.pipeline_config.questions.map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type === "short_text" ? "short" : q.type === "long_text" ? "long" : "file",
      file_label: q.file_label,
    }));
  }
  return (opp.custom_fields ?? []).map((f) => ({
    id: f.id,
    label: f.question,
    type: f.inputType,
  }));
}

export function ApplyModal({ opportunity, artistProfile, artistWorks, availableWorks, badges, isJobOpportunity = false, professionalCvUrl = null, draft = null, onClose, onSuccess }: Props) {
  const artistDocs = (opportunity.pipeline_config?.artist_documents ?? []) as string[];
  const showPortfolioPicker = artistDocs.includes("portfolio");
  const showAvailableWorksPicker = artistDocs.includes("available_works");
  const portfolioPickCount = opportunity.pipeline_config?.portfolio_pick_count ?? 3;

  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>(
    draft?.creative_work_ids ?? (draft?.creative_work_id ? [draft.creative_work_id] : [])
  );
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(draft?.artwork_id ?? null);
  const [submittedImageUrl, setSubmittedImageUrl] = useState<string | null>(draft?.submitted_image_url ?? null);
  const [submittedImagePreview, setSubmittedImagePreview] = useState<string | null>(draft?.submitted_image_url ?? null);
  const [uploadingNewImage, setUploadingNewImage] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(draft?.custom_answers ?? {});
  const [fileUploads, setFileUploads] = useState<Record<string, string[]>>({});
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const newImageRef = useRef<HTMLInputElement | null>(null);

  const displayName = artistProfile.full_name ?? artistProfile.username;
  const exhibitionCount = (artistProfile.exhibition_history ?? []).length;
  const fields = normaliseFields(opportunity);

  async function handleNewImageUpload(file: File) {
    setUploadingNewImage(true);
    setError(null);
    const path = `submissions/${opportunity.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type });
    setUploadingNewImage(false);
    if (uploadError) {
      setError("Image upload failed: " + uploadError.message);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    setSubmittedImageUrl(publicUrl);
    setSubmittedImagePreview(URL.createObjectURL(file));
    setSelectedWorkIds([]);
    setSelectedArtworkId(null);
  }

  function toggleWorkSelection(workId: string) {
    setSelectedWorkIds((prev) => {
      if (prev.includes(workId)) return prev.filter((id) => id !== workId);
      if (prev.length >= portfolioPickCount) return prev; // cap reached — ignore
      return [...prev, workId];
    });
    setSelectedArtworkId(null);
    setSubmittedImageUrl(null);
    setSubmittedImagePreview(null);
  }

  const FILE_CAP = 10;
  const ACCEPTED_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif,.mp4,.mp3";

  async function handleFileUpload(fieldId: string, files: FileList) {
    const current = fileUploads[fieldId] ?? [];
    const remaining = FILE_CAP - current.length;
    if (remaining <= 0) return;

    const toUpload = Array.from(files).slice(0, remaining);
    setUploadingFields((prev) => ({ ...prev, [fieldId]: true }));
    setError(null);

    const newUrls: string[] = [];
    const newNames: string[] = [];

    for (const file of toUpload) {
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_");
      const path = `answers/${opportunity.id}/${fieldId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("opportunity-images")
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError(`Upload failed for "${file.name}": ${uploadError.message}`);
        break;
      }
      const { data: { publicUrl } } = supabase.storage.from("opportunity-images").getPublicUrl(path);
      newUrls.push(publicUrl);
      newNames.push(file.name);
    }

    if (newUrls.length > 0) {
      const updatedUrls = [...(fileUploads[fieldId] ?? []), ...newUrls];
      const updatedNames = [...(fileNames[fieldId] ?? []), ...newNames];
      setFileUploads((prev) => ({ ...prev, [fieldId]: updatedUrls }));
      setFileNames((prev) => ({ ...prev, [fieldId]: updatedNames }));
      const encoded = JSON.stringify(updatedUrls);
      setAnswers((prev) => { const next = { ...prev }; next[fieldId] = encoded; return next; });
    }

    setUploadingFields((prev) => ({ ...prev, [fieldId]: false }));
  }

  function removeUploadedFile(fieldId: string, index: number) {
    setFileUploads((prev) => {
      const updated = (prev[fieldId] ?? []).filter((_, i) => i !== index);
      setAnswers((ans) => ({ ...ans, [fieldId]: updated.length > 0 ? JSON.stringify(updated) : "" } as Record<string, string>));
      return { ...prev, [fieldId]: updated };
    });
    setFileNames((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] ?? []).filter((_, i) => i !== index),
    }));
  }

  async function doSaveDraft() {
    setSavingDraft(true);
    setDraftSaved(false);
    const encodedFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(fileUploads)) encodedFiles[k] = JSON.stringify(v);
    const finalAnswers = { ...answers, ...encodedFiles };
    const firstSelectedWork = artistWorks.find((w) => w.id === selectedWorkIds[0]) ?? null;
    const selectedArtwork = availableWorks.find((w) => w.id === selectedArtworkId) ?? null;
    const effectiveImageUrl = isJobOpportunity
      ? professionalCvUrl
      : (submittedImageUrl ?? firstSelectedWork?.image_url ?? selectedArtwork?.thumb_url ?? selectedArtwork?.url ?? null);
    await saveDraft(
      opportunity.id,
      isJobOpportunity ? null : selectedArtworkId,
      finalAnswers,
      effectiveImageUrl,
      isJobOpportunity ? [] : selectedWorkIds,
    );
    setSavingDraft(false);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  async function handleSaveDraft() {
    await doSaveDraft();
  }

  // Autosave — debounced, fires a couple seconds after the artist stops typing/
  // uploading. Skips the initial mount (draft was just loaded, nothing to save yet).
  const hasMountedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (opportunity.routing_type !== "pipeline") return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      doSaveDraft();
    }, 2500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, selectedWorkIds, selectedArtworkId, submittedImageUrl]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const encodedFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(fileUploads)) encodedFiles[k] = JSON.stringify(v);
    const finalAnswers = { ...answers, ...encodedFiles };
    const firstSelectedWork = artistWorks.find((w) => w.id === selectedWorkIds[0]) ?? null;
    const selectedArtwork = availableWorks.find((w) => w.id === selectedArtworkId) ?? null;
    const effectiveImageUrl = isJobOpportunity
      ? professionalCvUrl
      : (submittedImageUrl ?? firstSelectedWork?.image_url ?? selectedArtwork?.thumb_url ?? selectedArtwork?.url ?? null);

    const result = await submitApplication(
      opportunity.id,
      isJobOpportunity ? null : selectedArtworkId,
      finalAnswers,
      effectiveImageUrl,
      marketingOptIn,
      isJobOpportunity ? [] : selectedWorkIds,
    );
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      onSuccess();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-black w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden">
        {/* Reference sidebar — desktop only, always visible so they can check the brief while writing */}
        <div className="hidden md:block md:w-72 md:shrink-0 md:border-r md:border-black md:overflow-y-auto">
          <ListingReference opportunity={opportunity} />
        </div>

        {/* Form column */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-black">
            <div>
              <h2 className="text-sm font-semibold">Apply with Patronage</h2>
              <p className="text-xs text-muted-foreground">{opportunity.title}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Mobile-only collapsible listing reference */}
            <details className="md:hidden border-b border-black group">
              <summary className="cursor-pointer list-none flex items-center justify-between px-6 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                View listing details
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <ListingReference opportunity={opportunity} />
            </details>

            <div className="px-6 py-6 space-y-6">
          {/* Artist profile summary */}
          <div className="border border-black p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your Profile</p>
            <div className="flex items-start gap-4">
              {artistProfile.avatar_url && (
                <div className="relative w-16 h-16 shrink-0 border border-black overflow-hidden">
                  <Image
                    src={artistProfile.avatar_url}
                    alt={displayName}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              )}
              <div className="space-y-1 min-w-0">
                <p className="font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">@{artistProfile.username}</p>
                {(artistProfile.medium ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(artistProfile.medium ?? []).slice(0, 3).map((m) => (
                      <span key={m} className="text-xs border border-black px-1.5 py-0.5 leading-none">{m}</span>
                    ))}
                  </div>
                )}
                {exhibitionCount > 0 && (
                  <p className="text-xs text-muted-foreground">{exhibitionCount} exhibition{exhibitionCount !== 1 ? "s" : ""}</p>
                )}
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

            {artistProfile.bio && (
              <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">{artistProfile.bio}</p>
            )}
          </div>

          {/* T&C download (pipeline_config) */}
          {opportunity.pipeline_config?.terms_pdf_url && (
            <div className="border border-black/20 px-4 py-3 flex items-center gap-3">
              <svg className="w-4 h-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <a
                href={opportunity.pipeline_config.terms_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline underline-offset-2"
              >
                Download terms &amp; conditions →
              </a>
            </div>
          )}

          {/* Job: Professional CV attachment — or Artist: Artwork selector */}
          {isJobOpportunity ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest">Professional CV</p>
              {professionalCvUrl ? (
                <div className="flex items-center gap-3 border border-black px-4 py-3">
                  <svg className="w-4 h-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">CV attached</p>
                    <a href={professionalCvUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline underline-offset-2">
                      Preview →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-black/40 px-4 py-3 space-y-1">
                  <p className="text-sm text-muted-foreground">No professional CV uploaded.</p>
                  <a href="/settings?tab=cv-press" target="_blank" className="text-xs underline underline-offset-2">
                    Upload one in Settings →
                  </a>
                </div>
              )}
            </div>
          ) : (showPortfolioPicker || showAvailableWorksPicker) ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest">Submit a Work (optional)</p>
              <p className="text-xs text-muted-foreground">
                {showPortfolioPicker && showAvailableWorksPicker
                  ? `Pick up to ${portfolioPickCount} work${portfolioPickCount !== 1 ? "s" : ""} from your portfolio, or one available (for-sale) work, to include with this application.`
                  : showAvailableWorksPicker
                  ? "Pick one of your available (for-sale) works to include with this application."
                  : `Pick up to ${portfolioPickCount} work${portfolioPickCount !== 1 ? "s" : ""} from your portfolio to include with this application.`}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {/* None tile */}
                <button
                  type="button"
                  onClick={() => { setSelectedWorkIds([]); setSelectedArtworkId(null); setSubmittedImageUrl(null); setSubmittedImagePreview(null); }}
                  className={`aspect-square border text-xs flex items-center justify-center transition-colors ${
                    selectedWorkIds.length === 0 && selectedArtworkId === null && !submittedImageUrl
                      ? "border-black bg-muted"
                      : "border-black/30 hover:border-black"
                  }`}
                >
                  None
                </button>

                {/* Upload image tile */}
                <button
                  type="button"
                  onClick={() => newImageRef.current?.click()}
                  disabled={uploadingNewImage}
                  className={`aspect-square border relative overflow-hidden flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
                    submittedImageUrl
                      ? "border-black ring-2 ring-black"
                      : "border-dashed border-black/40 hover:border-black"
                  }`}
                >
                  {submittedImagePreview ? (
                    <Image src={submittedImagePreview} alt="New upload" fill className="object-cover" sizes="80px" />
                  ) : uploadingNewImage ? (
                    <span className="text-muted-foreground text-[10px]">Uploading…</span>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground leading-tight text-center px-1">Upload image</span>
                    </>
                  )}
                </button>
                <input
                  ref={newImageRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNewImageUpload(f); }}
                />

                {/* Available (for-sale) works */}
                {showAvailableWorksPicker && availableWorks.slice(0, 10).map((work) => {
                  const selected = selectedArtworkId === work.id;
                  return (
                    <button
                      key={work.id}
                      type="button"
                      onClick={() => { setSelectedArtworkId(work.id); setSelectedWorkIds([]); setSubmittedImageUrl(null); setSubmittedImagePreview(null); }}
                      className={`aspect-square border relative overflow-hidden transition-colors flex flex-col items-center justify-center gap-1 ${
                        selected ? "border-black ring-2 ring-black" : "border-black/30 hover:border-black"
                      }`}
                    >
                      <Image src={work.thumb_url ?? work.url} alt={work.caption ?? work.title ?? ""} fill className="object-cover" sizes="80px" />
                      <span className={`absolute bottom-0 inset-x-0 text-center text-[8px] py-0.5 uppercase tracking-wide ${selected ? "bg-black text-white" : "bg-white/80 text-stone-500"}`}>
                        For sale
                      </span>
                    </button>
                  );
                })}

                {/* Creative works — all media types. Multi-select up to portfolioPickCount. */}
                {showPortfolioPicker && artistWorks.slice(0, 10).map((work) => {
                  const selected = selectedWorkIds.includes(work.id);
                  const capReached = !selected && selectedWorkIds.length >= portfolioPickCount;
                  const baseClass = `aspect-square border relative overflow-hidden transition-colors flex flex-col items-center justify-center gap-1 ${
                    selected
                      ? "border-black ring-2 ring-black"
                      : capReached
                      ? "border-black/10 opacity-40 cursor-not-allowed"
                      : "border-black/30 hover:border-black"
                  }`;
                  return (
                    <button
                      key={work.id}
                      type="button"
                      disabled={capReached}
                      onClick={() => toggleWorkSelection(work.id)}
                      className={baseClass}
                    >
                      {selected && (
                        <span className="absolute top-1 left-1 z-10 w-4 h-4 rounded-full bg-black text-white text-[9px] flex items-center justify-center leading-none">
                          {selectedWorkIds.indexOf(work.id) + 1}
                        </span>
                      )}
                      {work.content_type === "image" && work.image_url ? (
                        <Image src={work.image_url} alt={work.caption ?? ""} fill className="object-cover" sizes="80px" />
                      ) : work.content_type === "audio" ? (
                        <>
                          {work.image_url && <Image src={work.image_url} alt="" fill className="object-cover opacity-30" sizes="80px" />}
                          <Music className={`w-5 h-5 relative z-10 ${selected ? "text-white" : "text-stone-500"}`} />
                          <span className={`text-[9px] leading-tight text-center px-1 relative z-10 line-clamp-2 ${selected ? "text-white" : "text-stone-500"}`}>
                            {work.title ?? work.caption ?? "Audio"}
                          </span>
                        </>
                      ) : work.content_type === "video" ? (
                        <>
                          {work.image_url && <Image src={work.image_url} alt="" fill className="object-cover opacity-30" sizes="80px" />}
                          <Play className={`w-5 h-5 relative z-10 ${selected ? "text-white" : "text-stone-500"}`} />
                          <span className={`text-[9px] leading-tight text-center px-1 relative z-10 line-clamp-2 ${selected ? "text-white" : "text-stone-500"}`}>
                            {work.title ?? work.caption ?? "Video"}
                          </span>
                        </>
                      ) : work.content_type === "text" ? (
                        <>
                          <FileText className={`w-5 h-5 ${selected ? "text-white" : "text-stone-500"}`} />
                          <span className={`text-[9px] leading-tight text-center px-1 line-clamp-2 ${selected ? "text-white" : "text-stone-500"}`}>
                            {work.title ?? work.caption ?? "Writing"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Link className={`w-5 h-5 ${selected ? "text-white" : "text-stone-500"}`} />
                          <span className={`text-[9px] leading-tight text-center px-1 line-clamp-2 ${selected ? "text-white" : "text-stone-500"}`}>
                            {work.title ?? work.embed_provider ?? "Embed"}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedWorkIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedWorkIds
                    .map((id) => artistWorks.find((a) => a.id === id))
                    .filter((w): w is NonNullable<typeof w> => !!w)
                    .map((w) => w.title ?? w.caption ?? w.content_type)
                    .join(", ")}
                  {" "}({selectedWorkIds.length}/{portfolioPickCount})
                </p>
              )}
              {selectedArtworkId && (() => {
                const w = availableWorks.find((a) => a.id === selectedArtworkId);
                return w ? (
                  <p className="text-xs text-muted-foreground">{w.title ?? w.caption ?? ""}</p>
                ) : null;
              })()}
              {submittedImageUrl && (
                <p className="text-xs text-muted-foreground">New image uploaded.</p>
              )}
            </div>
          ) : null}

          {/* Questions (normalised from pipeline_config or custom_fields) */}
          {fields.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest">Questions</p>
              {fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-sm font-medium">{field.label}</label>
                  {field.file_label && (
                    <p className="text-xs text-muted-foreground">{field.file_label}</p>
                  )}
                  {field.type === "short" && (
                    <input
                      type="text"
                      value={answers[field.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  )}
                  {field.type === "long" && (
                    <textarea
                      rows={4}
                      value={answers[field.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
                    />
                  )}
                  {field.type === "file" && (
                    <div className="space-y-2">
                      {/* Uploaded files list */}
                      {(fileUploads[field.id] ?? []).length > 0 && (
                        <ul className="space-y-1">
                          {(fileUploads[field.id] ?? []).map((url, i) => (
                            <li key={url} className="flex items-center gap-2 text-xs">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline underline-offset-2 truncate max-w-[260px]"
                                title={fileNames[field.id]?.[i] ?? url}
                              >
                                {fileNames[field.id]?.[i] ?? `File ${i + 1}`}
                              </a>
                              <button
                                type="button"
                                onClick={() => removeUploadedFile(field.id, i)}
                                className="text-muted-foreground hover:text-foreground shrink-0"
                                aria-label="Remove file"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Upload button (hidden when cap reached) */}
                      {(fileUploads[field.id] ?? []).length < FILE_CAP && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileRefs.current[field.id]?.click()}
                            disabled={uploadingFields[field.id]}
                            className="text-xs border border-black px-3 py-2 hover:bg-muted transition-colors disabled:opacity-50"
                          >
                            {uploadingFields[field.id]
                              ? "Uploading…"
                              : (fileUploads[field.id] ?? []).length > 0
                              ? "Add more files"
                              : "Choose files"}
                          </button>
                          {(fileUploads[field.id] ?? []).length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {fileUploads[field.id].length}/{FILE_CAP}
                            </span>
                          )}
                        </div>
                      )}

                      <input
                        ref={(el) => { fileRefs.current[field.id] = el; }}
                        type="file"
                        multiple
                        accept={ACCEPTED_TYPES}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) handleFileUpload(field.id, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Partner data disclosure — shown for all pipeline opportunities */}
          {opportunity.routing_type === "pipeline" && (
            <div className="space-y-3">
              <div className="border border-black/20 bg-stone-50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                This opportunity is run by <strong className="text-foreground">{opportunity.organiser}</strong>.
                Your responses will be shared with <strong className="text-foreground">{opportunity.organiser}</strong> for
                application evaluation. <strong className="text-foreground">{opportunity.organiser}</strong> will also
                receive aggregated reporting on all applicants. Your individual data will not be
                used for marketing.
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-black"
                />
                <span className="text-xs text-muted-foreground">
                  I&rsquo;m happy for <strong className="text-foreground">{opportunity.organiser}</strong> to contact me about their services.
                </span>
              </label>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {opportunity.routing_type === "pipeline" && (
            <p className="text-xs text-muted-foreground -mt-2">
              {savingDraft ? "Saving…" : draftSaved ? "Saved ✓" : "Your progress saves automatically."}
            </p>
          )}

          <div className="flex gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-black px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            {opportunity.routing_type === "pipeline" && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="flex-1 border border-black px-4 py-2.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                {savingDraft ? "Saving…" : draftSaved ? "Draft saved ✓" : "Save draft"}
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-black text-white px-4 py-2.5 text-sm hover:bg-black/80 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
