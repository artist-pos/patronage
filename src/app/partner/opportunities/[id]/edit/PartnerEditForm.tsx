"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  OpportunityForm,
  oppToFormData,
  type OpportunityFormData,
} from "@/components/opportunities/OpportunityForm";
import { updateOpportunityPartner, publishOpportunityPartner } from "./actions";
import type { Opportunity } from "@/types/database";

interface Props {
  opp: Opportunity;
}

export function PartnerEditForm({ opp }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState<OpportunityFormData>(() =>
    oppToFormData(opp)
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
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

  function buildUpdatePayload(d: OpportunityFormData = formData) {
    const allTags = [
      ...d.selectedDisciplines,
      ...d.selectedCareerStages,
      ...d.selectedTags,
    ];

    const pipelineConfig =
      d.routingType === "pipeline"
        ? {
            questions: d.questions,
            artist_documents: d.artistDocs,
            terms_pdf_url: d.termsPdfUrl,
          }
        : null;

    return {
      title: d.title.trim() || opp.title,
      organiser: d.organiser.trim() || opp.organiser,
      caption: d.caption.trim() || null,
      full_description: d.fullDescription.trim() || null,
      url: d.url.trim() || null,
      type: d.type,
      country: d.country,
      city: d.city.trim() || null,
      opens_at: d.opensAt || null,
      deadline: d.deadline || null,
      funding_range: d.fundingRange.trim() || null,
      featured_image_url: d.featuredImageUrl.trim() || null,
      sub_categories: d.selectedDisciplines.length > 0 ? d.selectedDisciplines : null,
      career_stage: d.selectedCareerStages.length > 0 ? d.selectedCareerStages : null,
      tags: d.selectedTags.length > 0 ? d.selectedTags : null,
      entry_fee: d.entryFee !== "" ? parseFloat(d.entryFee) : null,
      grant_type: d.grantType.trim() || null,
      recipients_count: d.recipientsCount ? parseInt(d.recipientsCount) : null,
      artist_payment_type: d.artistPaymentType || null,
      travel_support: d.travelSupport,
      travel_support_details: d.travelSupportDetails.trim() || null,
      routing_type: d.routingType,
      show_badges_in_submission: d.showBadges,
      pipeline_config: pipelineConfig,
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateOpportunityPartner(opp.id, buildUpdatePayload());
      setToast("Saved");
      setTimeout(() => setToast(null), 3000);
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      // Save latest changes first
      await updateOpportunityPartner(opp.id, buildUpdatePayload());
      await publishOpportunityPartner(opp.id);
      setToast("Published! Your listing is now live.");
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Publish failed");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setPublishing(false);
    }
  }

  const canPublish = opp.status === "draft" || opp.status === "draft_unclaimed";

  return (
    <div className="space-y-6">
      <OpportunityForm
        value={formData}
        onChange={update}
        mode="admin"
        onImgUpload={handleImgUpload}
        onAutoSave={async (data) => {
          await updateOpportunityPartner(opp.id, buildUpdatePayload(data));
        }}
      />

      <div className="flex items-center justify-between pt-6 border-t border-black/20">
        <div>
          {toast && (
            <p
              className={`text-xs ${
                toast.startsWith("Saved") || toast.startsWith("Published")
                  ? "text-green-600"
                  : "text-destructive"
              }`}
            >
              {toast}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || publishing}
            className="text-xs border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          {canPublish && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving || publishing}
              className="text-xs border border-black bg-black text-white px-4 py-2 hover:bg-white hover:text-black transition-colors disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Save & Publish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
