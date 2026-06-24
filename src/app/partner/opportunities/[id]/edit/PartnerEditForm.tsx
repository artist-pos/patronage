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
import type { Opportunity, PostSelectionConfig, PostSelectionDocField, PipelineConfig } from "@/types/database";
import { Lightbulb, Plus, Trash2, GripVertical } from "lucide-react";

interface Props {
  opp: Opportunity;
}

const UPDATE_FREQUENCY_OPTIONS: { label: string; value: 7 | 14 | 30 | 90 }[] = [
  { label: "Weekly", value: 7 },
  { label: "Fortnightly", value: 14 },
  { label: "Monthly", value: 30 },
  { label: "Quarterly", value: 90 },
];

const DOC_FIELD_TYPES: { label: string; value: PostSelectionDocField["type"] }[] = [
  { label: "Short text", value: "text" },
  { label: "Long text", value: "rich_text" },
  { label: "Link / URL", value: "link" },
  { label: "File upload", value: "file" },
];

function defaultPostSelection(): PostSelectionConfig {
  return {
    requires_campaign: false,
    requires_studio_updates: false,
    update_frequency_days: 30,
    requires_documentation: false,
    doc_fields: [],
  };
}

function initPostSelection(opp: Opportunity): PostSelectionConfig {
  const pc = opp.pipeline_config as PipelineConfig | null;
  return pc?.post_selection ?? defaultPostSelection();
}

export function PartnerEditForm({ opp }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState<OpportunityFormData>(() =>
    oppToFormData(opp)
  );
  const [postSel, setPostSel] = useState<PostSelectionConfig>(() =>
    initPostSelection(opp)
  );
  const [showCampaignTip, setShowCampaignTip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const supabase = createClient();

  function update(updates: Partial<OpportunityFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  function updatePostSel(updates: Partial<PostSelectionConfig>) {
    setPostSel((prev) => ({ ...prev, ...updates }));
  }

  function addDocField() {
    const newField: PostSelectionDocField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
    };
    setPostSel((prev) => ({ ...prev, doc_fields: [...prev.doc_fields, newField] }));
  }

  function updateDocField(id: string, updates: Partial<PostSelectionDocField>) {
    setPostSel((prev) => ({
      ...prev,
      doc_fields: prev.doc_fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  }

  function removeDocField(id: string) {
    setPostSel((prev) => ({
      ...prev,
      doc_fields: prev.doc_fields.filter((f) => f.id !== id),
    }));
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
    const pipelineConfig =
      d.routingType === "pipeline"
        ? {
            questions: d.questions,
            artist_documents: d.artistDocs,
            terms_pdf_url: d.termsPdfUrl,
            post_selection: postSel,
          }
        : null;

    const appLinks = d.applicationLinks.filter((l) => l.url.trim() || l.label.trim());

    return {
      title: d.title.trim() || opp.title,
      organiser: d.organiser.trim() || opp.organiser,
      caption: d.caption.trim() || null,
      full_description: d.fullDescription.trim() || null,
      url: appLinks.find((l) => l.url.trim())?.url.trim() || null,
      application_links: appLinks,
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
      entry_fee_currency: d.entryFeeCurrency || "NZD",
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
  const isPipeline = formData.routingType === "pipeline";

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

      {isPipeline && (
        <div className="border border-black/10 rounded-xl p-6 space-y-6">
          <h3 className="text-xs font-medium uppercase tracking-widest text-stone-400">
            After selection
          </h3>

          {/* Campaign page */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={postSel.requires_campaign}
                onClick={() => updatePostSel({ requires_campaign: !postSel.requires_campaign })}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  postSel.requires_campaign ? "bg-black" : "bg-stone-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    postSel.requires_campaign ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm font-medium">Campaign page</span>
              <button
                type="button"
                className="text-stone-400 hover:text-stone-600 transition-colors"
                onClick={() => setShowCampaignTip((v) => !v)}
                aria-label="What is a campaign page?"
              >
                <Lightbulb size={15} />
              </button>
            </div>
            {showCampaignTip && (
              <div className="ml-12 text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-3 max-w-md">
                A campaign page gives each selected artist a public-facing URL with their work, QR code, and optional storefront. Best suited to public art, exhibitions, and commissions — less relevant for grants or residencies. We set up the campaign scaffold together once artists are selected.
              </div>
            )}
          </div>

          {/* Studio updates */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={postSel.requires_studio_updates}
                onClick={() => updatePostSel({ requires_studio_updates: !postSel.requires_studio_updates })}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  postSel.requires_studio_updates ? "bg-black" : "bg-stone-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    postSel.requires_studio_updates ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm font-medium">Studio updates</span>
            </div>
            {postSel.requires_studio_updates && (
              <div className="ml-12 space-y-2">
                <p className="text-xs text-stone-500">
                  Artists will receive a reminder on this cadence to post a project update. Not enforced — it's a nudge, not a deadline.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {UPDATE_FREQUENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updatePostSel({ update_frequency_days: opt.value })}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        postSel.update_frequency_days === opt.value
                          ? "bg-black text-white border-black"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Document submission */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={postSel.requires_documentation}
                onClick={() => updatePostSel({ requires_documentation: !postSel.requires_documentation })}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  postSel.requires_documentation ? "bg-black" : "bg-stone-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    postSel.requires_documentation ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm font-medium">Document submission</span>
            </div>
            {postSel.requires_documentation && (
              <div className="ml-12 space-y-3">
                <p className="text-xs text-stone-500">
                  Define what you need from selected artists — links, files, text, or uploads.
                </p>
                {postSel.doc_fields.map((field, idx) => (
                  <div key={field.id} className="border border-stone-100 rounded-lg p-3 space-y-2 bg-white">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-stone-300 shrink-0" />
                      <span className="text-xs text-stone-400 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        placeholder="Field label e.g. Artist statement"
                        value={field.label}
                        onChange={(e) => updateDocField(field.id, { label: e.target.value })}
                        className="flex-1 text-sm border-0 border-b border-stone-200 focus:border-black focus:outline-none pb-0.5 bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => removeDocField(field.id)}
                        className="text-stone-300 hover:text-red-400 transition-colors ml-1"
                        aria-label="Remove field"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pl-8">
                      <select
                        value={field.type}
                        onChange={(e) => updateDocField(field.id, { type: e.target.value as PostSelectionDocField["type"] })}
                        className="text-xs border border-stone-200 rounded px-2 py-1 focus:outline-none focus:border-black bg-white"
                      >
                        {DOC_FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateDocField(field.id, { required: e.target.checked })}
                          className="rounded"
                        />
                        Required
                      </label>
                    </div>
                    <div className="pl-8">
                      <input
                        type="text"
                        placeholder="Optional description or instructions"
                        value={field.description ?? ""}
                        onChange={(e) => updateDocField(field.id, { description: e.target.value || undefined })}
                        className="w-full text-xs border-0 border-b border-stone-100 focus:border-stone-300 focus:outline-none pb-0.5 bg-transparent text-stone-500 placeholder:text-stone-300"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDocField}
                  className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-black transition-colors"
                >
                  <Plus size={13} />
                  Add field
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
