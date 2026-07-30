"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitApplication, saveDraft } from "@/app/opportunities/[id]/actions";
import { formatFunding } from "@/components/opportunities/OpportunityCard";
import type { OpportunityApplicationDraft } from "@/types/database";
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
        <div className="border border-border overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.featured_image_url} alt={o.title} className="w-full max-h-40 object-contain" />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          <span className="tag">{o.type}</span>
          {o.country && <span className="tag">{o.country}</span>}
        </div>
        <h3 className="t-heading">{o.title}</h3>
        <p className="t-mono-sm text-[color:var(--fg-muted)]">{o.organiser}</p>
      </div>

      {(o.sub_categories ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(o.sub_categories ?? []).map((cat) => (
            <span key={cat} className="tag pill-subdued">{cat}</span>
          ))}
        </div>
      )}

      {hasStats && (
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          {fundingLabel && (
            <div>
              <p className="t-section-label">Funding</p>
              <p className="text-xs font-medium">{fundingLabel}</p>
            </div>
          )}
          {deadline && (
            <div>
              <p className="t-section-label">Deadline</p>
              <p className="text-xs font-medium">{deadline}</p>
            </div>
          )}
          {opensAt && (
            <div>
              <p className="t-section-label">Opens</p>
              <p className="text-xs font-medium">{opensAt}</p>
            </div>
          )}
          {location && (
            <div>
              <p className="t-section-label">Location</p>
              <p className="text-xs font-medium">{location}</p>
            </div>
          )}
          {o.entry_fee != null && (
            <div>
              <p className="t-section-label">Entry Fee</p>
              <p className="text-xs font-medium">{o.entry_fee === 0 ? "Free" : `NZD ${o.entry_fee}`}</p>
            </div>
          )}
          {o.artist_payment_type && (
            <div>
              <p className="t-section-label">Artist Payment</p>
              <p className="text-xs font-medium">{o.artist_payment_type}</p>
            </div>
          )}
          {o.travel_support != null && (
            <div>
              <p className="t-section-label">Travel Support</p>
              <p className="text-xs font-medium">{o.travel_support ? "Yes" : "No"}</p>
            </div>
          )}
        </div>
      )}

      {bodyText && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="t-section-label">About</p>
          <p className="t-body-sm whitespace-pre-wrap">{bodyText}</p>
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
  /** The artist's portfolio (artworks where is_available = false) — not for sale. */
  artistWorks: AvailableWork[];
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
  const askForWorkDescriptions = opportunity.pipeline_config?.work_descriptions_enabled ?? false;

  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>(
    draft?.creative_work_ids ?? (draft?.creative_work_id ? [draft.creative_work_id] : [])
  );
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(draft?.artwork_id ?? null);
  // Per-work description overrides, keyed by artwork id. A key being PRESENT is
  // what marks "wrote a new one for this application" — an absent key means the
  // partner sees the work's own live description instead, so we never copy that
  // in here. Mirrors the work_descriptions column (migration 178).
  const [workDescriptions, setWorkDescriptions] = useState<Record<string, string>>(
    draft?.work_descriptions ?? {}
  );
  // Kept read-only for backward compat with drafts saved before the picker
  // became the only way to attach a work — no UI writes to these anymore
  // (a free-upload tile defeated the point of picking from real, existing works).
  const [submittedImageUrl, setSubmittedImageUrl] = useState<string | null>(draft?.submitted_image_url ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(draft?.custom_answers ?? {});
  const [fileUploads, setFileUploads] = useState<Record<string, string[]>>({});
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set on a blocked submit — reveals which works still need describing rather
  // than only naming the problem down by the button.
  const [showDescriptionErrors, setShowDescriptionErrors] = useState(false);
  const supabase = createClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const displayName = artistProfile.full_name ?? artistProfile.username;
  const exhibitionCount = (artistProfile.exhibition_history ?? []).length;
  const fields = normaliseFields(opportunity);

  function toggleWorkSelection(workId: string) {
    if (selectedWorkIds.includes(workId)) {
      setSelectedWorkIds((prev) => prev.filter((id) => id !== workId));
      // Deselecting drops any description written for it — saveDraft prunes
      // detached works server-side too, so keeping it here would only diverge.
      dropWorkDescription(workId);
    } else {
      if (selectedWorkIds.length >= portfolioPickCount) return; // cap reached — ignore
      setSelectedWorkIds((prev) => [...prev, workId]);
    }
    if (selectedArtworkId) dropWorkDescription(selectedArtworkId);
    setSelectedArtworkId(null);
    setSubmittedImageUrl(null);
  }

  // ── Per-work descriptions (only rendered when the partner asked for them) ──

  // Key-presence in workDescriptions is the mode flag, so switching back to
  // "use existing" has to delete the text. This keeps a copy so flipping the
  // radio twice doesn't silently bin what they wrote.
  const workDescriptionCache = useRef<Record<string, string>>({ ...(draft?.work_descriptions ?? {}) });

  function writeWorkDescription(workId: string, text: string) {
    workDescriptionCache.current[workId] = text;
    setWorkDescriptions((prev) => ({ ...prev, [workId]: text }));
  }

  function dropWorkDescription(workId: string) {
    setWorkDescriptions((prev) => {
      if (prev[workId] === undefined) return prev;
      const next = { ...prev };
      delete next[workId];
      return next;
    });
  }

  /** Switch a work to "write a new one" — restoring whatever they had typed
   *  before, else seeded with the work's existing description so they edit
   *  rather than start from a blank box. */
  function startWorkDescription(workId: string, existing: string | null) {
    setWorkDescriptions((prev) => ({
      ...prev,
      [workId]: prev[workId] ?? workDescriptionCache.current[workId] ?? existing ?? "",
    }));
  }

  function clearAllWorkSelections() {
    setSelectedWorkIds([]);
    setSelectedArtworkId(null);
    setSubmittedImageUrl(null);
    setWorkDescriptions({});
  }

  // Works currently attached, in the order the partner will see them. Only one
  // of the two branches is ever populated — picking from one picker clears the
  // other — but both are listed so the section doesn't depend on that rule.
  const attachedWorks = [
    ...selectedWorkIds.map((id) => artistWorks.find((w) => w.id === id)),
    ...(selectedArtworkId ? [availableWorks.find((w) => w.id === selectedArtworkId)] : []),
  ].filter((w): w is AvailableWork => !!w);

  // A work is described if it carries an override OR its own description stands
  // in — "use existing" is a valid answer, not a skipped field. Empty when the
  // partner didn't ask, so submission is never blocked on a hidden section.
  const missingDescriptionIds = new Set(
    askForWorkDescriptions
      ? attachedWorks
          .filter((w) => !(workDescriptions[w.id]?.trim() || w.description?.trim()))
          .map((w) => w.id)
      : []
  );

  // Segmented mode switch, per the v2 vocabulary (solid fill = active).
  const modeSegCls = (active: boolean) =>
    `px-3 py-1.5 font-mono text-[11px] transition-colors ${
      active ? "bg-foreground text-white" : "bg-card text-muted-foreground hover:text-foreground"
    }`;

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
      : (submittedImageUrl ?? firstSelectedWork?.thumb_url ?? firstSelectedWork?.url ?? selectedArtwork?.thumb_url ?? selectedArtwork?.url ?? null);
    await saveDraft(
      opportunity.id,
      isJobOpportunity ? null : selectedArtworkId,
      finalAnswers,
      effectiveImageUrl,
      isJobOpportunity ? [] : selectedWorkIds,
      isJobOpportunity ? {} : workDescriptions,
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
  }, [answers, selectedWorkIds, selectedArtworkId, submittedImageUrl, workDescriptions]);

  // Clear the blocked-submit state as soon as the last gap is filled, so the
  // artist isn't reading a stale complaint while typing.
  useEffect(() => {
    if (showDescriptionErrors && missingDescriptionIds.size === 0) {
      setShowDescriptionErrors(false);
      setError(null);
    }
  }, [showDescriptionErrors, missingDescriptionIds.size]);

  async function handleSubmit() {
    // Required descriptions gate submission (the server re-checks — a client
    // can't be trusted with a partner's requirement).
    if (missingDescriptionIds.size > 0) {
      setShowDescriptionErrors(true);
      setError(
        missingDescriptionIds.size === 1
          ? "Describe the work you've attached before submitting, or deselect it."
          : `Describe all ${missingDescriptionIds.size} works you've attached before submitting, or deselect them.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setShowDescriptionErrors(false);

    const encodedFiles: Record<string, string> = {};
    for (const [k, v] of Object.entries(fileUploads)) encodedFiles[k] = JSON.stringify(v);
    const finalAnswers = { ...answers, ...encodedFiles };
    const firstSelectedWork = artistWorks.find((w) => w.id === selectedWorkIds[0]) ?? null;
    const selectedArtwork = availableWorks.find((w) => w.id === selectedArtworkId) ?? null;
    const effectiveImageUrl = isJobOpportunity
      ? professionalCvUrl
      : (submittedImageUrl ?? firstSelectedWork?.thumb_url ?? firstSelectedWork?.url ?? selectedArtwork?.thumb_url ?? selectedArtwork?.url ?? null);

    const result = await submitApplication(
      opportunity.id,
      isJobOpportunity ? null : selectedArtworkId,
      finalAnswers,
      effectiveImageUrl,
      marketingOptIn,
      isJobOpportunity ? [] : selectedWorkIds,
      isJobOpportunity ? {} : workDescriptions,
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
      <div className="bg-background border border-border shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden">
        {/* Reference sidebar — desktop only, always visible so they can check the brief while writing */}
        <div className="hidden md:block md:w-72 md:shrink-0 md:border-r md:border-border md:overflow-y-auto">
          <ListingReference opportunity={opportunity} />
        </div>

        {/* Form column */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="space-y-0.5">
              <h2 className="t-heading">Apply with Patronage</h2>
              <p className="t-mono-sm text-[color:var(--fg-muted)]">{opportunity.title}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Mobile-only collapsible listing reference */}
            <details className="md:hidden border-b border-border group">
              <summary className="cursor-pointer list-none flex items-center justify-between px-6 py-3.5 t-section-label">
                View listing details
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <ListingReference opportunity={opportunity} />
            </details>

            <div className="px-6 py-6 space-y-7">
          {/* Artist profile summary */}
          <div className="space-y-3">
            <p className="t-section-label">Your profile</p>
            <div className="flex items-start gap-4">
              {artistProfile.avatar_url && (
                <div className="relative w-16 h-16 shrink-0 border border-border overflow-hidden">
                  <Image
                    src={artistProfile.avatar_url}
                    alt={displayName}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              )}
              <div className="space-y-1.5 min-w-0">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)]">@{artistProfile.username}</p>
                {(artistProfile.medium ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(artistProfile.medium ?? []).slice(0, 3).map((m) => (
                      <span key={m} className="tag">{m}</span>
                    ))}
                  </div>
                )}
                {exhibitionCount > 0 && (
                  <p className="t-mono-sm text-[color:var(--fg-subtle)]">{exhibitionCount} exhibition{exhibitionCount !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>

            {/* Badges */}
            {opportunity.show_badges_in_submission && badges && (
              <div className="flex flex-wrap gap-1.5">
                {badges.withPatronage && <span className="badge badge-verified">With Patronage</span>}
                {badges.verified && <span className="badge badge-verified">Verified</span>}
                {badges.exhibited && <span className="badge badge-exhibited">Exhibited</span>}
                {badges.grantRecipient && <span className="badge badge-grant">Grant recipient</span>}
                {badges.collected && <span className="badge">Collected</span>}
              </div>
            )}

            {artistProfile.bio && (
              <p className="t-body-sm line-clamp-3">{artistProfile.bio}</p>
            )}
          </div>

          {/* T&C download (pipeline_config) */}
          {opportunity.pipeline_config?.terms_pdf_url && (
            <div className="border border-border px-4 py-3 flex items-center gap-3">
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
            <div className="space-y-2.5">
              <p className="t-section-label">Professional CV</p>
              {professionalCvUrl ? (
                <div className="flex items-center gap-3 border border-border px-4 py-3">
                  <svg className="w-4 h-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">CV attached</p>
                    <a href={professionalCvUrl} target="_blank" rel="noopener noreferrer" className="t-mono-sm text-[color:var(--fg-muted)] underline underline-offset-2 hover:text-foreground transition-colors">
                      Preview →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-border px-4 py-3 space-y-1">
                  <p className="t-body-sm">No professional CV uploaded.</p>
                  <a href="/settings?tab=cv-press" target="_blank" className="t-mono-sm underline underline-offset-2">
                    Upload one in Settings →
                  </a>
                </div>
              )}
            </div>
          ) : (showPortfolioPicker || showAvailableWorksPicker) ? (
            <div className="space-y-3">
              <p className="t-section-label">Submit a work (optional)</p>
              <p className="t-body-sm">
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
                  onClick={clearAllWorkSelections}
                  className={`aspect-square border font-mono text-[11px] flex items-center justify-center transition-colors ${
                    selectedWorkIds.length === 0 && selectedArtworkId === null && !submittedImageUrl
                      ? "border-foreground bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  none
                </button>

                {/* Available (for-sale) works */}
                {showAvailableWorksPicker && availableWorks.slice(0, 10).map((work) => {
                  const selected = selectedArtworkId === work.id;
                  return (
                    <button
                      key={work.id}
                      type="button"
                      onClick={() => {
                        if (selectedArtworkId && selectedArtworkId !== work.id) dropWorkDescription(selectedArtworkId);
                        selectedWorkIds.forEach(dropWorkDescription);
                        setSelectedArtworkId(work.id);
                        setSelectedWorkIds([]);
                        setSubmittedImageUrl(null);
                      }}
                      className={`aspect-square border relative overflow-hidden transition-colors flex flex-col items-center justify-center gap-1 ${
                        selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground"
                      }`}
                    >
                      <Image src={work.thumb_url ?? work.url} alt={work.caption ?? work.title ?? ""} fill className="object-cover" sizes="80px" />
                      <span className={`absolute bottom-0 inset-x-0 text-center font-mono text-[9px] leading-none py-1 uppercase tracking-[0.08em] ${selected ? "bg-foreground text-white" : "bg-white/85 text-[color:var(--fg-muted)]"}`}>
                        for sale
                      </span>
                    </button>
                  );
                })}

                {/* Portfolio works. Multi-select up to portfolioPickCount. */}
                {showPortfolioPicker && artistWorks.slice(0, 10).map((work) => {
                  const selected = selectedWorkIds.includes(work.id);
                  const capReached = !selected && selectedWorkIds.length >= portfolioPickCount;
                  return (
                    <button
                      key={work.id}
                      type="button"
                      disabled={capReached}
                      onClick={() => toggleWorkSelection(work.id)}
                      className={`aspect-square border relative overflow-hidden transition-colors flex flex-col items-center justify-center gap-1 ${
                        selected
                          ? "border-foreground ring-1 ring-foreground"
                          : capReached
                          ? "border-border opacity-40 cursor-not-allowed"
                          : "border-border hover:border-foreground"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-0 left-0 z-10 w-5 h-5 bg-foreground text-white font-mono text-[10px] flex items-center justify-center leading-none">
                          {selectedWorkIds.indexOf(work.id) + 1}
                        </span>
                      )}
                      <Image src={work.thumb_url ?? work.url} alt={work.caption ?? work.title ?? ""} fill className="object-cover" sizes="80px" />
                    </button>
                  );
                })}
              </div>
              {selectedWorkIds.length > 0 && (
                <p className="t-mono-sm text-[color:var(--fg-muted)]">
                  {selectedWorkIds
                    .map((id) => artistWorks.find((a) => a.id === id))
                    .filter((w): w is NonNullable<typeof w> => !!w)
                    .map((w) => w.title ?? w.caption ?? "Untitled")
                    .join(" · ")}
                  {" "}({selectedWorkIds.length}/{portfolioPickCount})
                </p>
              )}
              {selectedArtworkId && (() => {
                const w = availableWorks.find((a) => a.id === selectedArtworkId);
                return w ? (
                  <p className="t-mono-sm text-[color:var(--fg-muted)]">{w.title ?? w.caption ?? ""}</p>
                ) : null;
              })()}
              {submittedImageUrl && (
                <p className="t-mono-sm text-[color:var(--fg-subtle)]">Image from an earlier draft is attached.</p>
              )}

              {/* Per-work descriptions — shown only when the partner asked for
                  them (pipeline_config.work_descriptions_enabled), and then
                  REQUIRED for every attached work. Attaching works is still
                  optional; describing the ones you attach is not. */}
              {askForWorkDescriptions && attachedWorks.length > 0 && (
                <div className="space-y-4 border-t border-border pt-5">
                  <div className="space-y-1.5">
                    <p className="t-section-label">
                      {attachedWorks.length === 1 ? "About this work" : "About these works"}
                      <span className="ml-1 text-[color:var(--urgent)]">*</span>
                    </p>
                    <p className="t-body-sm">
                      {opportunity.organiser} asks for a description of every work you attach.
                    </p>
                  </div>

                  <div className="divide-y divide-border">
                    {attachedWorks.map((work) => {
                      const existing = work.description?.trim() || null;
                      const override = workDescriptions[work.id];
                      const isOverride = override !== undefined;
                      const workLabel = work.title ?? work.caption ?? "Untitled";
                      const isMissing = missingDescriptionIds.has(work.id);
                      const flagged = showDescriptionErrors && isMissing;

                      return (
                        <div key={work.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-border">
                              <Image src={work.thumb_url ?? work.url} alt={workLabel} fill className="object-cover" sizes="44px" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{workLabel}</p>
                              {flagged && (
                                <p className="t-mono-sm text-[color:var(--urgent)]">Description required</p>
                              )}
                            </div>
                          </div>

                          {/* Mode switch — only meaningful when the work already
                              carries a description worth reusing. */}
                          {existing && (
                            <div className="inline-flex items-stretch border border-border">
                              <button
                                type="button"
                                onClick={() => dropWorkDescription(work.id)}
                                className={modeSegCls(!isOverride)}
                              >
                                Use existing
                              </button>
                              <button
                                type="button"
                                onClick={() => startWorkDescription(work.id, existing)}
                                className={`border-l border-border ${modeSegCls(isOverride)}`}
                              >
                                Write new
                              </button>
                            </div>
                          )}

                          {existing && !isOverride ? (
                            <p className="whitespace-pre-wrap border-l-2 border-border pl-3 t-body-sm">
                              {existing}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              <textarea
                                rows={4}
                                value={override ?? ""}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  if (text === "" && existing) dropWorkDescription(work.id);
                                  else writeWorkDescription(work.id, text);
                                }}
                                placeholder={`What ${opportunity.organiser} should know about this work…`}
                                className={`w-full resize-none bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none ${
                                  flagged
                                    ? "border border-[color:var(--urgent)] focus:border-[color:var(--urgent)]"
                                    : "border border-border focus:border-foreground"
                                }`}
                              />
                              {!existing && (
                                <p className="t-mono-sm text-[color:var(--fg-subtle)]">
                                  This work has no saved description — what you write here applies to this application only.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Questions (normalised from pipeline_config or custom_fields) */}
          {fields.length > 0 && (
            <div className="space-y-4">
              <p className="t-section-label">Questions</p>
              {fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-sm font-medium">{field.label}</label>
                  {field.file_label && (
                    <p className="t-caption">{field.file_label}</p>
                  )}
                  {field.type === "short" && (
                    <input
                      type="text"
                      value={answers[field.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
                    />
                  )}
                  {field.type === "long" && (
                    <textarea
                      rows={4}
                      value={answers[field.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full resize-none border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:border-foreground"
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
                            className="btn btn-ghost btn-sm disabled:opacity-50"
                          >
                            {uploadingFields[field.id]
                              ? "Uploading…"
                              : (fileUploads[field.id] ?? []).length > 0
                              ? "Add more files"
                              : "Choose files"}
                          </button>
                          {(fileUploads[field.id] ?? []).length > 0 && (
                            <span className="t-mono-sm text-[color:var(--fg-subtle)]">
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
              <div className="border border-border bg-muted px-4 py-3 text-xs leading-relaxed text-[color:var(--fg-muted)]">
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
                <span className="text-xs text-[color:var(--fg-muted)]">
                  I&rsquo;m happy for <strong className="text-foreground">{opportunity.organiser}</strong> to contact me about their services.
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="border-l-2 border-[color:var(--urgent)] pl-3 text-xs text-[color:var(--urgent)]">
              {error}
            </p>
          )}

          {opportunity.routing_type === "pipeline" && (
            <p className="t-mono-sm -mt-2 text-[color:var(--fg-subtle)]">
              {savingDraft ? "Saving…" : draftSaved ? "Saved ✓" : "Your progress saves automatically."}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            {opportunity.routing_type === "pipeline" && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="btn btn-outline flex-1 disabled:opacity-50"
              >
                {savingDraft ? "Saving…" : draftSaved ? "Draft saved ✓" : "Save draft"}
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary flex-1 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
