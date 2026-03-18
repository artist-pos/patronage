"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { updateOpportunityAdmin } from "@/app/opportunities/[id]/actions";
import type { Opportunity } from "@/types/database";
import { OpportunityForm, oppToFormData, type OpportunityFormData } from "@/components/opportunities/OpportunityForm";
import { createClient } from "@/lib/supabase/client";

interface Props {
  opp: Opportunity;
  /** Controlled mode — set open state externally */
  forceOpen?: boolean;
  onForceClose?: () => void;
}

export function AdminEditOpportunityModal({ opp, forceOpen, onForceClose }: Props) {
  const isControlled = forceOpen !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const open = isControlled ? forceOpen : selfOpen;
  const setOpen = isControlled
    ? (val: boolean) => { if (!val) onForceClose?.(); }
    : setSelfOpen;
  const [formData, setFormData] = useState<OpportunityFormData>(() => oppToFormData(opp));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const supabase = createClient();

  function update(updates: Partial<OpportunityFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  async function handleImgUpload(file: File): Promise<string | null> {
    const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const allTags = [
        ...formData.selectedDisciplines,
        ...formData.selectedCareerStages,
        ...formData.selectedEligibility,
        ...formData.customEligibility,
        ...formData.selectedFocus,
      ];

      const pipelineConfig = formData.routingType === "pipeline" ? {
        questions: formData.questions,
        artist_documents: formData.artistDocs,
        terms_pdf_url: formData.termsPdfUrl,
      } : null;

      await updateOpportunityAdmin(opp.id, {
        title: formData.title.trim() || opp.title,
        organiser: formData.organiser.trim() || opp.organiser,
        caption: formData.caption.trim() || null,
        full_description: formData.fullDescription.trim() || null,
        url: formData.url.trim() || null,
        type: formData.type,
        country: formData.country,
        city: formData.city.trim() || null,
        opens_at: formData.opensAt || null,
        deadline: formData.deadline || null,
        funding_range: formData.fundingRange.trim() || null,
        featured_image_url: formData.featuredImageUrl.trim() || null,
        sub_categories: allTags.length > 0 ? allTags : null,
        entry_fee: formData.entryFee !== "" ? parseFloat(formData.entryFee) : null,
        grant_type: formData.grantType.trim() || null,
        recipients_count: formData.recipientsCount ? parseInt(formData.recipientsCount) : null,
        artist_payment_type: formData.artistPaymentType || null,
        travel_support: formData.travelSupport,
        travel_support_details: formData.travelSupportDetails.trim() || null,
        routing_type: formData.routingType,
        show_badges_in_submission: formData.showBadges,
        is_featured: formData.isFeatured,
        pipeline_config: pipelineConfig,
        is_recurring: formData.isRecurring,
        recurrence_pattern: formData.isRecurring && formData.recurrencePattern ? formData.recurrencePattern : null,
        recurrence_open_day: formData.isRecurring && formData.recurrenceOpenDay ? parseInt(formData.recurrenceOpenDay) : null,
        recurrence_close_day: formData.isRecurring && formData.recurrenceCloseDay ? parseInt(formData.recurrenceCloseDay) : null,
        recurrence_end_date: formData.isRecurring && formData.recurrenceEndDate ? formData.recurrenceEndDate : null,
      });
      setToast("Saved");
      setTimeout(() => {
        setToast(null);
        setOpen(false);
      }, 1200);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors font-medium"
      >
        Edit Opportunity
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-background border border-black w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black sticky top-0 bg-background z-10">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Edit Opportunity</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-6">
              <OpportunityForm
                value={formData}
                onChange={update}
                mode="admin"
                onImgUpload={handleImgUpload}
              />

              {/* Save */}
              <div className="flex items-center justify-between pt-6 mt-4 border-t border-black/20">
                {toast && (
                  <p className={`text-xs ${toast === "Saved" ? "text-green-600" : "text-destructive"}`}>
                    {toast}
                  </p>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-xs border border-black px-4 py-2 hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs border border-black bg-black text-white px-4 py-2 hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
