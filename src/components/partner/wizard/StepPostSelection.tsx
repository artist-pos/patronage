"use client";

import { useState } from "react";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import type { PostSelectionConfig, PostSelectionDocField, PipelineConfig } from "@/types/database";

interface NotificationDefaults {
  shortlisted: "send" | "hold";
  rejected: "send" | "hold";
  selected: "send" | "hold";
}

interface Props {
  postSelection: PostSelectionConfig;
  notificationDefaults: NotificationDefaults;
  onPostSelectionChange: (config: PostSelectionConfig) => void;
  onNotificationDefaultsChange: (defaults: NotificationDefaults) => void;
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

const NOTIFICATION_STAGES: { key: keyof NotificationDefaults; label: string; desc: string }[] = [
  { key: "shortlisted", label: "Shortlisted", desc: "Notify artists when they're moved to the shortlist" },
  { key: "rejected", label: "Not selected", desc: "Notify artists when they're declined" },
  { key: "selected", label: "Selected", desc: "Notify artists when they're selected" },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${on ? "bg-black" : "bg-stone-200"}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

export function StepPostSelection({
  postSelection,
  notificationDefaults,
  onPostSelectionChange,
  onNotificationDefaultsChange,
}: Props) {
  const [showCampaignTip, setShowCampaignTip] = useState(false);

  function update(patch: Partial<PostSelectionConfig>) {
    onPostSelectionChange({ ...postSelection, ...patch });
  }

  function addDocField() {
    const field: PostSelectionDocField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
    };
    update({ doc_fields: [...postSelection.doc_fields, field] });
  }

  function updateDocField(id: string, patch: Partial<PostSelectionDocField>) {
    update({
      doc_fields: postSelection.doc_fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function removeDocField(id: string) {
    update({ doc_fields: postSelection.doc_fields.filter((f) => f.id !== id) });
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Post-selection</h2>
        <p className="text-sm text-stone-500">
          Configure what happens after artists are selected, and how notifications are handled.
        </p>
      </div>

      {/* Notification defaults */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Email notifications</h3>
          <p className="text-xs text-stone-500">
            Choose the default behaviour when you change an application&apos;s status. You can override per-notification in the pipeline view.
          </p>
        </div>
        <div className="space-y-3">
          {NOTIFICATION_STAGES.map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 border border-black/10 p-4">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-stone-500">{desc}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {(["send", "hold"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onNotificationDefaultsChange({ ...notificationDefaults, [key]: opt })}
                    className={`text-xs px-3 py-1 border transition-colors ${
                      notificationDefaults[key] === opt
                        ? "border-black bg-black text-white"
                        : "border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    {opt === "send" ? "Send" : "Hold"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-stone-400">
          &ldquo;Hold&rdquo; queues the notification so you can review and edit it before sending.
        </p>
      </div>

      {/* Programme requirements */}
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Programme requirements</h3>
          <p className="text-xs text-stone-500">What you&apos;ll need from selected artists.</p>
        </div>

        {/* Campaign */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Toggle
              on={postSelection.requires_campaign}
              onToggle={() => update({ requires_campaign: !postSelection.requires_campaign })}
            />
            <span className="text-sm font-medium">Campaign page</span>
            <button
              type="button"
              onClick={() => setShowCampaignTip((v) => !v)}
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
          </div>
          {showCampaignTip && (
            <p className="ml-12 text-xs text-stone-500 bg-stone-50 border border-stone-100 p-3 max-w-md">
              A campaign page gives each selected artist a public-facing URL with their work, QR code, and optional storefront. Best suited to public art, exhibitions, and commissions.
            </p>
          )}
        </div>

        {/* Studio updates */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Toggle
              on={postSelection.requires_studio_updates}
              onToggle={() => update({ requires_studio_updates: !postSelection.requires_studio_updates })}
            />
            <span className="text-sm font-medium">Studio updates</span>
          </div>
          {postSelection.requires_studio_updates && (
            <div className="ml-12 space-y-2">
              <p className="text-xs text-stone-500">
                Artists receive a reminder on this cadence to post a project update.
              </p>
              <div className="flex gap-2 flex-wrap">
                {UPDATE_FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update({ update_frequency_days: opt.value })}
                    className={`text-xs px-3 py-1.5 border transition-colors ${
                      postSelection.update_frequency_days === opt.value
                        ? "border-black bg-black text-white"
                        : "border-stone-200 hover:border-black"
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
            <Toggle
              on={postSelection.requires_documentation}
              onToggle={() => update({ requires_documentation: !postSelection.requires_documentation })}
            />
            <span className="text-sm font-medium">Document submission</span>
          </div>
          {postSelection.requires_documentation && (
            <div className="ml-12 space-y-3">
              <p className="text-xs text-stone-500">
                Define what you need from selected artists — links, files, or text fields.
              </p>
              {postSelection.doc_fields.map((field, idx) => (
                <div key={field.id} className="border border-black/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      placeholder="Field label e.g. Artist statement"
                      value={field.label}
                      onChange={(e) => updateDocField(field.id, { label: e.target.value })}
                      className="flex-1 text-sm border-b border-black/10 focus:border-black focus:outline-none pb-0.5 bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeDocField(field.id)}
                      className="text-stone-400 hover:text-foreground transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 pl-5">
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateDocField(field.id, { type: e.target.value as PostSelectionDocField["type"] })
                      }
                      className="text-xs border border-black/20 px-2 py-1 focus:outline-none focus:border-black bg-background"
                    >
                      {DOC_FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateDocField(field.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addDocField}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-foreground transition-colors"
              >
                <Plus className="w-3 h-3" /> Add field
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
