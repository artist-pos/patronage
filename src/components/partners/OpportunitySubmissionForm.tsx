"use client";

import { useActionState, useRef, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { Button } from "@/components/ui/button";
import { OpportunityForm, defaultFormData, getDefaultPipelineSetup, type OpportunityFormData } from "@/components/opportunities/OpportunityForm";
import { submitOpportunityAction, type SubmissionState } from "@/app/partners/actions";
import { getFundingFieldMeta } from "@/lib/opportunity-constants";
import type { Opportunity, OppTypeEnum, CountryEnum } from "@/types/database";

// ── Image resize ──────────────────────────────────────────────────────────────
const MAX_IMG_PX = 1600;
async function resizeToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_IMG_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg", 0.9
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ── Date formatting ───────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-NZ", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export function OpportunitySubmissionForm({ isLoggedIn = false, partnerName = null }: { isLoggedIn?: boolean; partnerName?: string | null }) {
  const [state, action, isPending] = useActionState<SubmissionState, FormData>(
    submitOpportunityAction, {}
  );

  const [formData, setFormData] = useState<OpportunityFormData>(() =>
    defaultFormData(partnerName ?? "")
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  // Track which type was used to seed step 2 defaults
  const lastDefaultTypeRef = useRef<string | null>(null);

  const supabase = createClient();

  function update(updates: Partial<OpportunityFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  async function handleImgUpload(file: File): Promise<string | null> {
    const blob = await resizeToJpeg(file);
    const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleTermsUpload(file: File): Promise<string | null> {
    const path = `terms/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    return data.publicUrl;
  }

  // sub_categories = disciplines only; career_stage and tags go to separate columns
  const allTags = formData.selectedDisciplines;
  // All tags combined for preview display
  const allTagsForPreview = [
    ...formData.selectedDisciplines,
    ...formData.selectedCareerStages,
    ...formData.selectedTags,
  ];

  const pipelineConfigValue = formData.routingType === "pipeline" ? {
    questions: formData.questions,
    artist_documents: formData.artistDocs,
    terms_pdf_url: formData.termsPdfUrl,
  } : null;

  const fundingMeta = getFundingFieldMeta(formData.type);

  // Build the preview opportunity object
  const previewOpp: Opportunity = {
    id: "",
    title: formData.title || "Opportunity Title",
    organiser: formData.organiser || "Organisation",
    description: null,
    caption: formData.caption || null,
    full_description: formData.fullDescription || null,
    type: formData.type as OppTypeEnum,
    country: (formData.country as CountryEnum) ?? "NZ",
    city: formData.city || null,
    opens_at: formData.opensAt || null,
    deadline: formData.deadline || null,
    url: formData.url || null,
    funding_amount: null,
    funding_range: formData.fundingRange || null,
    sub_categories: allTagsForPreview.length > 0 ? allTagsForPreview : null,
    featured_image_url: formData.featuredImageUrl || null,
    grant_type: formData.grantType || null,
    recipients_count: formData.recipientsCount ? parseInt(formData.recipientsCount) : null,
    slug: null,
    is_active: true,
    status: "published",
    source_url: null,
    profile_id: null,
    created_at: new Date().toISOString(),
    entry_fee: formData.entryFee !== "" ? parseFloat(formData.entryFee) : null,
    artist_payment_type: null,
    travel_support: formData.travelSupport,
    travel_support_details: formData.travelSupportDetails || null,
    view_count: 0,
    routing_type: formData.routingType,
    custom_fields: [],
    show_badges_in_submission: formData.showBadges,
    is_featured: formData.isFeatured,
    pipeline_config: pipelineConfigValue,
    is_recurring: false,
    recurrence_pattern: null,
    recurrence_open_day: null,
    recurrence_close_day: null,
    recurrence_end_date: null,
    claim_token: null,
    claim_email: null,
    claim_token_expires_at: null,
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (state.success) {
    return (
      <div className="border border-black p-8 space-y-6">
        <div className="space-y-2">
          <p className="font-semibold">Submission received.</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll review your listing and publish it within two business days.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      {/* Card preview */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Card Preview</p>
        <div className="max-w-sm">
          <OpportunityCard opp={previewOpp} isPreview />
        </div>
      </div>

      {/* Full listing preview modal */}
      {showFullPreview && (
        <ListingPreviewModal
          opp={previewOpp}
          fundingLabel={fundingMeta.label}
          onClose={() => setShowFullPreview(false)}
        />
      )}

      <form action={action} className="space-y-0">
        {state.error && <p className="text-xs text-destructive mb-4">{state.error}</p>}

        {/* Hidden inputs — map controlled state to FormData for server action */}
        <input type="hidden" name="title"                      value={formData.title} />
        <input type="hidden" name="organiser"                  value={formData.organiser} />
        <input type="hidden" name="caption"                    value={formData.caption} />
        <input type="hidden" name="full_description"           value={formData.fullDescription} />
        <input type="hidden" name="url"                        value={formData.url} />
        <input type="hidden" name="type"                       value={formData.type} />
        <input type="hidden" name="country"                    value={formData.country} />
        <input type="hidden" name="city"                       value={formData.city} />
        <input type="hidden" name="opens_at"                   value={formData.opensAt} />
        <input type="hidden" name="deadline"                   value={formData.deadline} />
        <input type="hidden" name="funding_range"              value={formData.fundingRange} />
        <input type="hidden" name="featured_image_url"         value={formData.featuredImageUrl} />
        <input type="hidden" name="sub_categories"             value={allTags.join(",")} />
        <input type="hidden" name="career_stage"               value={formData.selectedCareerStages.join(",")} />
        <input type="hidden" name="tags"                       value={formData.selectedTags.join(",")} />
        <input type="hidden" name="entry_fee"                  value={formData.entryFee} />
        <input type="hidden" name="grant_type"                 value={formData.grantType} />
        <input type="hidden" name="recipients_count"           value={formData.recipientsCount} />
        <input type="hidden" name="travel_support"             value={formData.travelSupport === true ? "true" : ""} />
        <input type="hidden" name="travel_support_details"     value={formData.travelSupportDetails} />
        <input type="hidden" name="routing_type"               value={formData.routingType} />
        <input type="hidden" name="custom_fields"              value="[]" />
        <input type="hidden" name="show_badges_in_submission"  value={formData.showBadges ? "true" : "false"} />
        <input type="hidden" name="pipeline_config"            value={pipelineConfigValue ? JSON.stringify(pipelineConfigValue) : "null"} />
        <input type="hidden" name="is_featured"                value={formData.isFeatured ? "true" : "false"} />
        <input type="hidden" name="submitter_email"            value={formData.submitterEmail} />
        <input type="hidden" name="is_recurring"               value={formData.isRecurring ? "true" : "false"} />
        <input type="hidden" name="recurrence_pattern"         value={formData.recurrencePattern} />
        <input type="hidden" name="recurrence_end_date"        value={formData.recurrenceEndDate} />

        {/* Step indicator (pipeline only) */}
        {formData.routingType === "pipeline" && (
          <div className="text-xs text-muted-foreground font-mono mb-6 flex items-center gap-2">
            <span className={step === 1 ? "text-foreground font-semibold" : ""}>Step 1: Opportunity details</span>
            <span>→</span>
            <span className={step === 2 ? "text-foreground font-semibold" : ""}>Step 2: Application setup</span>
          </div>
        )}

        {/* Form body */}
        <OpportunityForm
          value={formData}
          onChange={update}
          mode="create"
          step={step}
          onImgUpload={handleImgUpload}
          onTermsUpload={handleTermsUpload}
        />

        {/* ── Footer: step nav / submit ─────────────────────────────────── */}
        {step === 1 && (
          <div className="pt-6 border-t-2 border-black space-y-3">
            {formData.routingType === "pipeline" ? (
              <button
                type="button"
                onClick={() => {
                  // Apply smart defaults if first entry or type changed
                  if (
                    formData.questions.length === 0 ||
                    lastDefaultTypeRef.current !== formData.type
                  ) {
                    const defaults = getDefaultPipelineSetup(formData.type);
                    update({ questions: defaults.questions, artistDocs: defaults.artistDocs });
                    lastDefaultTypeRef.current = formData.type;
                  }
                  setStep(2);
                }}
                className="w-full sm:w-auto border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
              >
                Next: Configure application →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setShowFullPreview(true); setHasPreviewed(true); }}
                  className="w-full sm:w-auto border border-black px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Preview full listing →
                </button>

                {hasPreviewed ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    {isLoggedIn ? (
                      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                        {isPending ? "Submitting…" : "Submit Opportunity"}
                      </Button>
                    ) : (
                      <div className="space-y-1">
                        <a
                          href="/auth/login?next=/partners"
                          className="inline-block border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
                        >
                          Sign in to submit →
                        </a>
                        <p className="text-xs text-muted-foreground">
                          Don&apos;t have an account?{" "}
                          <a href="/auth/signup?next=/partners" className="underline underline-offset-2">Sign up free</a>
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowFullPreview(true); setHasPreviewed(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                    >
                      Preview again
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Preview your full listing before submitting.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {step === 2 && formData.routingType === "pipeline" && (
          <div className="pt-6 border-t-2 border-black flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="border border-black px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              ← Back
            </button>
            {isLoggedIn ? (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Publishing…" : "Publish opportunity →"}
              </Button>
            ) : (
              <div className="space-y-1">
                <a
                  href="/auth/login?next=/partners"
                  className="inline-block border border-black bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-white hover:text-black transition-colors"
                >
                  Sign in to submit →
                </a>
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <a href="/auth/signup?next=/partners" className="underline underline-offset-2">Sign up free</a>
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

// ── Full listing preview modal ────────────────────────────────────────────────
function ListingPreviewModal({
  opp,
  fundingLabel,
  onClose,
}: {
  opp: Opportunity;
  fundingLabel: string;
  onClose: () => void;
}) {
  const location = opp.city ? `${opp.city}, ${opp.country}` : opp.country;

  const previewQuestions = opp.pipeline_config?.questions?.length
    ? opp.pipeline_config.questions.map((q) => ({ id: q.id, text: q.label }))
    : (opp.custom_fields ?? []).map((f) => ({ id: f.id, text: f.question }));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="min-h-screen py-10 px-4 flex items-start justify-center">
        <div className="bg-background w-full max-w-2xl relative">
          {/* Preview banner */}
          <div className="bg-muted border-b border-black px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              Preview — how your listing will appear when published
            </p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-10 space-y-8">
            {/* Featured image */}
            {opp.featured_image_url ? (
              <div className="relative w-full border border-black overflow-hidden bg-white">
                <div
                  className="absolute inset-0 bg-cover bg-center scale-110 blur-xl opacity-20"
                  style={{ backgroundImage: `url(${opp.featured_image_url})` }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={opp.featured_image_url}
                  alt={opp.title}
                  className="relative z-10 w-full h-auto max-h-[360px] object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-40 bg-[#E5E7EB] border border-black" />
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.type}</span>
              <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.country}</span>
              {opp.grant_type && (
                <span className="text-xs border border-black px-1.5 py-0.5 leading-none">{opp.grant_type}</span>
              )}
              {opp.recipients_count != null && (
                <span className="text-xs border border-black px-1.5 py-0.5 leading-none">
                  {opp.recipients_count} recipient{opp.recipients_count !== 1 ? "s" : ""}
                </span>
              )}
              {(opp.sub_categories ?? []).map((cat) => (
                <span key={cat} className="text-xs border border-black/40 text-muted-foreground px-1.5 py-0.5 leading-none">
                  {cat}
                </span>
              ))}
            </div>

            {/* Title + organiser */}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{opp.title || "Opportunity Title"}</h1>
              <p className="text-sm text-muted-foreground font-mono">{opp.organiser || "Organisation"}</p>
            </div>

            {/* Vital stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border border-black p-5">
              {opp.funding_range && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{fundingLabel}</p>
                  <p className="font-mono font-bold text-sm">{opp.funding_range}</p>
                </div>
              )}
              {opp.opens_at && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Opens</p>
                  <p className="font-mono text-sm">{fmtDate(opp.opens_at)}</p>
                </div>
              )}
              {opp.deadline && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Deadline</p>
                  <p className="font-mono text-sm">{fmtDate(opp.deadline)}</p>
                </div>
              )}
              {location && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Location</p>
                  <p className="font-mono text-sm">{location}</p>
                </div>
              )}
              {opp.entry_fee != null && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Entry Fee</p>
                  <p className="font-mono text-sm">{opp.entry_fee === 0 ? "Free" : `$${opp.entry_fee}`}</p>
                </div>
              )}
              {opp.travel_support && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Accommodation</p>
                  <p className="font-mono text-sm">
                    Included{opp.travel_support_details ? ` — ${opp.travel_support_details}` : ""}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {(opp.caption || opp.full_description) && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</h2>
                {opp.caption && <p className="text-sm leading-relaxed">{opp.caption}</p>}
                {opp.full_description && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {opp.full_description}
                  </p>
                )}
              </div>
            )}

            {/* CTA mock */}
            <div className="space-y-2">
              {opp.routing_type === "pipeline" ? (
                <div className="space-y-2">
                  <button
                    disabled
                    className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold opacity-60 cursor-not-allowed"
                  >
                    Apply with Patronage →
                  </button>
                  {previewQuestions.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                      <p className="font-semibold uppercase tracking-widest mb-1">Application will ask for:</p>
                      {previewQuestions.map((q) => (
                        <p key={q.id}>· {q.text}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : opp.url ? (
                <span className="inline-flex items-center gap-2 border border-black bg-black text-white px-6 py-3 text-sm font-semibold opacity-60 cursor-not-allowed">
                  Apply on Official Site →
                </span>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-black px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="text-sm border border-black px-5 py-2 hover:bg-muted transition-colors"
            >
              Close preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
