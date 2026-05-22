"use client";

import { TEMPLATE_LABELS, PIPELINE_TEMPLATES, type TemplateKey } from "@/lib/pipeline-templates";
import type { PipelineConfig } from "@/types/database";

const TEMPLATE_DESCRIPTIONS: Record<TemplateKey, string> = {
  residency: "Time-based opportunities for artists to work in a specific place or context.",
  commission: "Paid commissions for new work to a specific brief.",
  grant: "Financial support for artistic projects or practice.",
  open_call: "Open invitations to submit work or proposals.",
  prize: "Competitive awards recognising artistic excellence.",
  display: "Opportunities to show or exhibit existing or new work.",
};

interface Props {
  selectedTemplate: TemplateKey | null;
  onChange: (template: TemplateKey, questions: PipelineConfig["questions"]) => void;
}

export function StepTemplate({ selectedTemplate, onChange }: Props) {
  const templates = Object.keys(TEMPLATE_LABELS) as TemplateKey[];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Choose a template</h2>
        <p className="text-sm text-stone-500">
          We&rsquo;ll pre-fill sensible application questions based on your opportunity type.
          You can customise everything in the next step.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key, PIPELINE_TEMPLATES[key])}
            className={`text-left border p-5 space-y-2 transition-colors hover:border-black ${
              selectedTemplate === key ? "border-black bg-stone-50" : "border-stone-200"
            }`}
          >
            <p className="text-sm font-semibold">{TEMPLATE_LABELS[key]}</p>
            <p className="text-xs text-stone-500 leading-relaxed">{TEMPLATE_DESCRIPTIONS[key]}</p>
            <p className="text-[11px] text-stone-400">
              {PIPELINE_TEMPLATES[key].length} default question{PIPELINE_TEMPLATES[key].length !== 1 ? "s" : ""}
            </p>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <p className="text-xs text-stone-400">
          {TEMPLATE_LABELS[selectedTemplate]} selected — continue to set your basics.
        </p>
      )}
    </div>
  );
}
