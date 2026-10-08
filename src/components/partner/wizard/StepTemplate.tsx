"use client";

import { TEMPLATE_LABELS, PIPELINE_TEMPLATES, type TemplateKey } from "@/lib/pipeline-templates";
import type { PipelineConfig } from "@/types/database";

const TEMPLATE_DESCRIPTIONS: Record<TemplateKey, string> = {
  mural_commission: "Large-scale wall paintings — site-specific murals, street art, or painted installations.",
  public_art_commission: "Sculptural, architectural, or site-responsive works for public spaces.",
  residency: "Time-based opportunities for artists to work in a specific place or context.",
  open_call: "Open invitations to submit work or proposals for exhibitions and group shows.",
  job_employment: "Paid roles — programme coordinators, gallery assistants, studio managers, and similar.",
  commission: "Paid commissions for new work to a specific brief.",
  grant: "Financial support for artistic projects or practice.",
  prize: "Competitive awards recognising artistic excellence.",
  display: "Opportunities to show or exhibit existing or new work.",
};

/** The five "featured" templates shown first (larger cards). */
const FEATURED_TEMPLATES: TemplateKey[] = [
  "mural_commission",
  "public_art_commission",
  "residency",
  "open_call",
  "job_employment",
];

interface Props {
  selectedTemplate: TemplateKey | null;
  onChange: (template: TemplateKey, questions: PipelineConfig["questions"]) => void;
  onStartFromScratch: () => void;
  isBlank: boolean;
}

export function StepTemplate({ selectedTemplate, onChange, onStartFromScratch, isBlank }: Props) {
  const allTemplates = Object.keys(TEMPLATE_LABELS) as TemplateKey[];
  const otherTemplates = allTemplates.filter((k) => !FEATURED_TEMPLATES.includes(k));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Where would you like to start?</h2>
        <p className="text-sm text-stone-500">
          Pick the one closest to what you are offering. We fill in sensible questions for artists to answer, and you can change every one of them later.
          You can customise everything in the next step.
        </p>
      </div>

      {/* Featured templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURED_TEMPLATES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key, PIPELINE_TEMPLATES[key])}
            className={`text-left border p-5 space-y-2 transition-colors hover:border-black ${
              selectedTemplate === key ? "border-black bg-stone-50" : "border-stone-200"
            }`}
          >
            <p className="text-sm font-semibold">{TEMPLATE_LABELS[key]}</p>
            <p className="text-sm text-stone-500 leading-relaxed">{TEMPLATE_DESCRIPTIONS[key]}</p>
            <p className="text-sm text-stone-500">
              {PIPELINE_TEMPLATES[key].length} default question{PIPELINE_TEMPLATES[key].length !== 1 ? "s" : ""}
            </p>
          </button>
        ))}

        {/* Start from scratch */}
        <button
          type="button"
          onClick={onStartFromScratch}
          className={`text-left border p-5 space-y-2 transition-colors hover:border-black ${
            isBlank ? "border-black bg-stone-50" : "border-stone-200 border-dashed"
          }`}
        >
          <p className="text-sm font-semibold">Start from scratch</p>
          <p className="text-sm text-stone-500 leading-relaxed">
            Begin with a blank form and add your own questions.
          </p>
        </button>
      </div>

      {/* Other templates */}
      {otherTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-500">Other templates</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {otherTemplates.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key, PIPELINE_TEMPLATES[key])}
                className={`text-left border p-5 space-y-2 transition-colors hover:border-black ${
                  selectedTemplate === key ? "border-black bg-stone-50" : "border-stone-200"
                }`}
              >
                <p className="text-sm font-semibold">{TEMPLATE_LABELS[key]}</p>
                <p className="text-sm text-stone-500 leading-relaxed">{TEMPLATE_DESCRIPTIONS[key]}</p>
                <p className="text-sm text-stone-500">
                  {PIPELINE_TEMPLATES[key].length} default question{PIPELINE_TEMPLATES[key].length !== 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedTemplate && (
        <p className="text-sm text-stone-500">
          {TEMPLATE_LABELS[selectedTemplate]} selected — continue to set your basics.
        </p>
      )}
      {isBlank && !selectedTemplate && (
        <p className="text-sm text-stone-500">
          Starting from scratch — continue to set your basics.
        </p>
      )}
    </div>
  );
}
