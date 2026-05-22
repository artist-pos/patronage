import type { PipelineQuestion } from "@/types/database";

function q(label: string, type: PipelineQuestion["type"], required = true): PipelineQuestion {
  return { id: crypto.randomUUID(), label, type, required };
}

export const PIPELINE_TEMPLATES: Record<string, PipelineQuestion[]> = {
  residency: [
    q("Describe your artistic practice", "long_text"),
    q("Proposed project or body of work for the residency", "long_text"),
    q("Timeline and milestones", "long_text"),
    q("Budget breakdown", "long_text"),
    q("Work samples (images, audio, or video)", "file_upload", false),
  ],
  commission: [
    q("Describe your artistic practice and relevant experience", "long_text"),
    q("Proposal for this commission", "long_text"),
    q("Budget breakdown", "long_text"),
    q("Timeline", "long_text"),
    q("Work samples", "file_upload"),
  ],
  grant: [
    q("Describe your artistic practice", "long_text"),
    q("Project description and intended outcomes", "long_text"),
    q("How will this grant support your work?", "long_text"),
    q("Budget", "long_text"),
    q("Timeline", "long_text"),
  ],
  open_call: [
    q("Describe your proposed work or contribution", "long_text"),
    q("Relevant experience or past work", "long_text"),
    q("Work samples", "file_upload"),
  ],
  prize: [
    q("Describe the work you are entering", "long_text"),
    q("Work samples or documentation", "file_upload"),
    q("Artist statement", "long_text", false),
  ],
  display: [
    q("Describe the work you are proposing for display", "long_text"),
    q("Technical requirements or specifications", "long_text", false),
    q("Work samples or images", "file_upload"),
  ],
};

export type TemplateKey = keyof typeof PIPELINE_TEMPLATES;

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  residency: "Residency",
  commission: "Commission",
  grant: "Grant",
  open_call: "Open Call",
  prize: "Prize",
  display: "Display",
};
