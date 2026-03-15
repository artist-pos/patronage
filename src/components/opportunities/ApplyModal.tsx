"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitApplication, saveDraft } from "@/app/opportunities/[id]/actions";
import type { Opportunity, Artwork, OpportunityApplicationDraft } from "@/types/database";
import type { BadgeSet } from "@/lib/badges";

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
  opportunity: Opportunity;
  artistProfile: ArtistProfile;
  artistArtworks: Artwork[];
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

function normaliseFields(opp: Opportunity): NormalisedField[] {
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

export function ApplyModal({ opportunity, artistProfile, artistArtworks, badges, isJobOpportunity = false, professionalCvUrl = null, draft = null, onClose, onSuccess }: Props) {
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(draft?.artwork_id ?? null);
  const [submittedImageUrl, setSubmittedImageUrl] = useState<string | null>(draft?.submitted_image_url ?? null);
  const [submittedImagePreview, setSubmittedImagePreview] = useState<string | null>(draft?.submitted_image_url ?? null);
  const [uploadingNewImage, setUploadingNewImage] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(draft?.custom_answers ?? {});
  const [fileUploads, setFileUploads] = useState<Record<string, string>>({});
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
    setSelectedArtworkId(null);
  }

  async function handleFileUpload(fieldId: string, file: File) {
    const path = `answers/${opportunity.id}/${fieldId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setError("File upload failed: " + uploadError.message);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    setFileUploads((prev) => ({ ...prev, [fieldId]: publicUrl }));
    setAnswers((prev) => ({ ...prev, [fieldId]: publicUrl }));
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    setDraftSaved(false);
    const finalAnswers = { ...answers, ...fileUploads };
    const effectiveImageUrl = isJobOpportunity ? professionalCvUrl : submittedImageUrl;
    await saveDraft(
      opportunity.id,
      isJobOpportunity ? null : selectedArtworkId,
      finalAnswers,
      effectiveImageUrl
    );
    setSavingDraft(false);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const finalAnswers = { ...answers, ...fileUploads };
    const effectiveImageUrl = isJobOpportunity ? professionalCvUrl : submittedImageUrl;

    const result = await submitApplication(opportunity.id, isJobOpportunity ? null : selectedArtworkId, finalAnswers, effectiveImageUrl);
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
      <div className="bg-background border border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black sticky top-0 bg-background z-10">
          <div>
            <h2 className="text-sm font-semibold">Apply with Patronage</h2>
            <p className="text-xs text-muted-foreground">{opportunity.title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

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
                  <a href="/onboarding" target="_blank" className="text-xs underline underline-offset-2">
                    Upload one in your profile settings →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest">Submit a Work (optional)</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {/* None tile */}
                <button
                  type="button"
                  onClick={() => { setSelectedArtworkId(null); setSubmittedImageUrl(null); setSubmittedImagePreview(null); }}
                  className={`aspect-square border text-xs flex items-center justify-center transition-colors ${
                    selectedArtworkId === null && !submittedImageUrl
                      ? "border-black bg-muted"
                      : "border-black/30 hover:border-black"
                  }`}
                >
                  None
                </button>

                {/* Upload new tile */}
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
                      <span className="text-[10px] text-muted-foreground leading-tight text-center px-1">Upload new</span>
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

                {/* Existing artworks */}
                {artistArtworks.slice(0, 10).map((artwork) => (
                  <button
                    key={artwork.id}
                    type="button"
                    onClick={() => { setSelectedArtworkId(artwork.id); setSubmittedImageUrl(null); setSubmittedImagePreview(null); }}
                    className={`aspect-square border relative overflow-hidden transition-colors ${
                      selectedArtworkId === artwork.id
                        ? "border-black ring-2 ring-black"
                        : "border-black/30 hover:border-black"
                    }`}
                  >
                    <Image
                      src={artwork.url}
                      alt={artwork.caption ?? ""}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
              {selectedArtworkId && (
                <p className="text-xs text-muted-foreground">
                  {artistArtworks.find((a) => a.id === selectedArtworkId)?.caption ?? ""}
                </p>
              )}
              {submittedImageUrl && (
                <p className="text-xs text-muted-foreground">New image uploaded.</p>
              )}
            </div>
          )}

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
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => fileRefs.current[field.id]?.click()}
                        className="text-xs border border-black px-3 py-2 hover:bg-muted transition-colors"
                      >
                        {fileUploads[field.id] ? "File uploaded. Click to replace." : "Choose file"}
                      </button>
                      <input
                        ref={(el) => { fileRefs.current[field.id] = el; }}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(field.id, f);
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

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
  );
}
