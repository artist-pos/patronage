"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import type { PostSelectionConfig, PostSelectionDocField } from "@/types/database";
import { savePostSelectionConfig } from "@/app/partner/dashboard/actions";

interface Props {
  opportunityId: string;
  opportunityTitle: string;
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

export function PostSelectionSetup({ opportunityId, opportunityTitle }: Props) {
  const router = useRouter();
  const [showCampaignTip, setShowCampaignTip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<PostSelectionConfig>({
    requires_campaign: false,
    requires_studio_updates: false,
    update_frequency_days: 30,
    requires_documentation: false,
    doc_fields: [],
  });

  function updateConfig(updates: Partial<PostSelectionConfig>) {
    setConfig((prev) => ({ ...prev, ...updates }));
  }

  function addDocField() {
    const field: PostSelectionDocField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
    };
    setConfig((prev) => ({ ...prev, doc_fields: [...prev.doc_fields, field] }));
  }

  function updateDocField(id: string, updates: Partial<PostSelectionDocField>) {
    setConfig((prev) => ({
      ...prev,
      doc_fields: prev.doc_fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  }

  function removeDocField(id: string) {
    setConfig((prev) => ({ ...prev, doc_fields: prev.doc_fields.filter((f) => f.id !== id) }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await savePostSelectionConfig(opportunityId, config);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Set up your programme requirements</h2>
        <p className="text-sm text-muted-foreground">
          Before you can review applications for <span className="font-medium text-foreground">{opportunityTitle}</span>, tell us what you'll need from selected artists. You can change these any time while selection is underway.
        </p>
      </div>

      <div className="border border-black/10 rounded-xl p-6 space-y-6">

        {/* Campaign page */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={config.requires_campaign}
              onClick={() => updateConfig({ requires_campaign: !config.requires_campaign })}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${config.requires_campaign ? "bg-black" : "bg-stone-200"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${config.requires_campaign ? "translate-x-4" : "translate-x-0"}`} />
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
              aria-checked={config.requires_studio_updates}
              onClick={() => updateConfig({ requires_studio_updates: !config.requires_studio_updates })}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${config.requires_studio_updates ? "bg-black" : "bg-stone-200"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${config.requires_studio_updates ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-sm font-medium">Studio updates</span>
          </div>
          {config.requires_studio_updates && (
            <div className="ml-12 space-y-2">
              <p className="text-xs text-stone-500">
                Artists will receive a reminder on this cadence to post a project update. Not enforced — it's a nudge, not a deadline.
              </p>
              <div className="flex gap-2 flex-wrap">
                {UPDATE_FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateConfig({ update_frequency_days: opt.value })}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      config.update_frequency_days === opt.value
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
              aria-checked={config.requires_documentation}
              onClick={() => updateConfig({ requires_documentation: !config.requires_documentation })}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${config.requires_documentation ? "bg-black" : "bg-stone-200"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${config.requires_documentation ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-sm font-medium">Document submission</span>
          </div>
          {config.requires_documentation && (
            <div className="ml-12 space-y-3">
              <p className="text-xs text-stone-500">
                Define what you need from selected artists — links, files, text, or uploads.
              </p>
              {config.doc_fields.map((field, idx) => (
                <div key={field.id} className="border border-stone-100 rounded-lg p-3 space-y-2 bg-white">
                  <div className="flex items-center gap-2">
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
                      className="text-stone-300 hover:text-red-400 transition-colors"
                      aria-label="Remove field"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 pl-5">
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
                  <div className="pl-5">
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

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-black text-white text-sm px-6 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save & view applications →"}
      </button>
    </div>
  );
}
